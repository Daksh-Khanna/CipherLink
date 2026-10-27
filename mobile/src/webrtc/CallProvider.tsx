import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Alert, AppState, PermissionsAndroid, Platform } from 'react-native';
import { RTCPeerConnection, RTCSessionDescription, RTCIceCandidate, mediaDevices, type MediaStream } from 'react-native-webrtc';
import InCallManager from 'react-native-incall-manager';
import type { Call, User } from '@cipherlink/shared';
import { useSession } from '../context/Session';
import { emitAck, errorMessage } from '../services/client';
import { trustContact } from '../services/storage';
import { audioDiagnostics } from './diagnostics';
type Status = 'Incoming call' | 'Calling…' | 'Connecting…' | 'Connected';
type CallState = { call: Call | null; status: Status; local: MediaStream | null; remote: MediaStream | null; muted: boolean; camera: boolean; speaker: boolean; seconds: number; start: (peer: User, kind: 'voice' | 'video') => Promise<void>; accept: () => Promise<void>; decline: () => void; end: () => void; toggleMute: () => void; toggleSpeaker: () => void; toggleCamera: () => void; switchCamera: () => void };
const Context = createContext<CallState>(null!);
export const useCalls = () => useContext(Context);
export function CallProvider({ children }: { children: React.ReactNode }) {
  const { session, server } = useSession();
  const [call, setCall] = useState<Call | null>(null);
  const callRef = useRef<Call | null>(null);
  const [status, setStatus] = useState<Status>('Calling…');
  const [local, setLocal] = useState<MediaStream | null>(null);
  const [remote, setRemote] = useState<MediaStream | null>(null);
  const [muted, setMuted] = useState(false); const [camera, setCamera] = useState(true);
  const mutedRef = useRef(false); const cameraRef = useRef(true);
  const [speaker, setSpeaker] = useState(false);
  const speakerRef = useRef(false);
  const audioOwner = useRef<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const iceQueue = useRef<any[]>([]);
  const generation = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const starting = useRef(false);
  const acceptedRef = useRef(false);
  const setCurrent = (c: Call | null) => {
    if (c) { speakerRef.current = c.kind === 'video'; setSpeaker(speakerRef.current); }
    callRef.current = c; setCall(c);
  };
  const stopAudio = (callId?: string) => {
    if (audioOwner.current && (!callId || audioOwner.current === callId)) { InCallManager.stop(); audioOwner.current = null; }
  };
  const cleanup = () => {
    generation.current++;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    peerRef.current?.close(); peerRef.current = null;
    streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current?.release(); streamRef.current = null;
    stopAudio(callRef.current?.id); speakerRef.current = false; setSpeaker(false);
    iceQueue.current = []; acceptedRef.current = false; mutedRef.current = false; cameraRef.current = true; setLocal(null); setRemote(null); setCurrent(null); setMuted(false); setCamera(true); setSeconds(0);
  };
  const signal = <T,>(event: string, data: unknown) => session ? emitAck<T>(session.socket, event, data) : Promise.reject(new Error('Please log in.'));
  const end = () => { const current = callRef.current; if (current) void signal(current.incoming && !acceptedRef.current ? 'call:reject' : 'call:end', { callId: current.id }).catch(() => {}); cleanup(); };
  const fail = (error: unknown) => { end(); Alert.alert('Call unavailable', errorMessage(error)); };
  const prepare = async (current: Call) => {
    if (peerRef.current) return peerRef.current;
    const version = generation.current;
    if (Platform.OS === 'android') {
      const requested = [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, ...(current.kind === 'video' ? [PermissionsAndroid.PERMISSIONS.CAMERA] : [])];
      const granted = await PermissionsAndroid.requestMultiple(requested);
      if (requested.some(p => granted[p] !== PermissionsAndroid.RESULTS.GRANTED)) throw new Error('Microphone and camera permissions are required for this call. Enable them in Android settings.');
    }
    const { data } = await session!.api.get('/network');
    if (version !== generation.current || callRef.current?.id !== current.id) throw new Error('Call ended.');
    InCallManager.start({ media: current.kind === 'video' ? 'video' : 'audio', auto: true });
    audioOwner.current = current.id;
    InCallManager.setForceSpeakerphoneOn(speakerRef.current);
    const stream = await mediaDevices.getUserMedia({ audio: true, video: current.kind === 'video' ? { facingMode: 'user', width: 640, height: 480, frameRate: 24 } : false });
    if (version !== generation.current || callRef.current?.id !== current.id) { stream.getTracks().forEach(t => t.stop()); stream.release(); stopAudio(current.id); throw new Error('Call ended.'); }
    // Respect choices made while ringing or awaiting permission before sending.
    stream.getAudioTracks().forEach(track => { track.enabled = !mutedRef.current; });
    stream.getVideoTracks().forEach(track => { track.enabled = cameraRef.current; });
    streamRef.current = stream; setLocal(stream);
    const pc = new RTCPeerConnection({ iceServers: data.iceServers });
    peerRef.current = pc;
    stream.getTracks().forEach(track => pc.addTrack(track, stream));
    pc.addEventListener('track', event => { if (peerRef.current === pc && event.streams[0]) setRemote(event.streams[0]); });
    pc.addEventListener('icecandidate', event => { if (peerRef.current === pc && event.candidate) void signal('call:ice', { callId: current.id, payload: event.candidate.toJSON() }).catch(error => { if (peerRef.current === pc) fail(error); }); });
    pc.addEventListener('connectionstatechange', () => {
      if (peerRef.current !== pc) return;
      if (pc.connectionState === 'connected') { if (timeoutRef.current) clearTimeout(timeoutRef.current); timeoutRef.current = null; setStatus('Connected'); }
      else if (pc.connectionState === 'failed') fail(new Error('Media connection failed. Check your Wi-Fi or TURN configuration.'));
      else if (pc.connectionState === 'disconnected') { setStatus('Connecting…'); if (timeoutRef.current) clearTimeout(timeoutRef.current); timeoutRef.current = setTimeout(() => fail(new Error('Media connection was lost.')), 12000); }
    });
    timeoutRef.current = setTimeout(() => fail(new Error('Media connection timed out. TURN may be required on this network.')), 35000);
    return pc;
  };
  const flushIce = async () => { const pc = peerRef.current; if (pc?.remoteDescription) { for (const c of iceQueue.current.splice(0)) await pc.addIceCandidate(new RTCIceCandidate(c)); } };
  useEffect(() => {
    if (!session) return;
    const socket = session.socket;
    const incoming = (c: Call) => {
      if (AppState.currentState !== 'active' || callRef.current || starting.current) { void emitAck(socket, 'call:reject', { callId: c.id }).catch(() => {}); return; }
      setCurrent(c); setStatus('Incoming call');
    };
    const accepted = async ({ callId }: { callId: string }) => {
      const current = callRef.current;
      if (!current || current.id !== callId) return;
      acceptedRef.current = true;
      setStatus('Connecting…');
      if (!current.incoming) try {
        const pc = await prepare(current);
        const offer = await pc.createOffer({}); await pc.setLocalDescription(offer);
        await emitAck(socket, 'call:offer', { callId, payload: { type: offer.type, sdp: offer.sdp } });
      } catch (error) { if (callRef.current?.id === callId) fail(error); }
    };
    // Serialize offer/answer/ICE handling, including async setRemoteDescription.
    let work = Promise.resolve();
    const handleSignal = (event: string) => (data: any) => {
      work = work.then(async () => {
        if (data.callId !== callRef.current?.id) return;
        if (event === 'call:ice') { iceQueue.current.push(data.payload); await flushIce(); return; }
        const pc = peerRef.current;
        if (!pc) throw new Error('Media connection is not ready.');
        await pc.setRemoteDescription(new RTCSessionDescription(data.payload)); await flushIce();
        if (event === 'call:offer') { const answer = await pc.createAnswer(); await pc.setLocalDescription(answer); await emitAck(socket, 'call:answer', { callId: data.callId, payload: { type: answer.type, sdp: answer.sdp } }); }
      }).catch(error => { if (callRef.current?.id === data.callId) fail(error); });
    };
    const offer = handleSignal('call:offer'), answer = handleSignal('call:answer'), ice = handleSignal('call:ice');
    const ended = (data: any) => { if (data.callId === callRef.current?.id) { cleanup(); if (!['Call ended', 'Accepted on another connection'].includes(data.reason)) Alert.alert('Call finished', data.reason); } };
    const disconnected = () => { if (callRef.current) { cleanup(); Alert.alert('Call disconnected', 'The signaling connection was lost.'); } };
    socket.on('call:incoming', incoming); socket.on('call:accepted', accepted); socket.on('call:offer', offer); socket.on('call:answer', answer); socket.on('call:ice', ice); socket.on('call:ended', ended); socket.on('disconnect', disconnected);
    const appSubscription = AppState.addEventListener('change', state => { if (state === 'background' && callRef.current) end(); });
    return () => { appSubscription.remove(); socket.off('call:incoming', incoming); socket.off('call:accepted', accepted); socket.off('call:offer', offer); socket.off('call:answer', answer); socket.off('call:ice', ice); socket.off('call:ended', ended); socket.off('disconnect', disconnected); cleanup(); };
  }, [session]);
  useEffect(() => { if (status !== 'Connected' || !call) return; const start = Date.now(); const timer = setInterval(() => setSeconds(Math.floor((Date.now() - start) / 1000)), 1000); return () => clearInterval(timer); }, [status, call?.id]);
  useEffect(() => {
    if (process.env.EXPO_PUBLIC_CALL_DIAGNOSTICS !== 'true' || status !== 'Connected') return;
    const pc = peerRef.current; if (!pc) return;
    let busy = false; let cancelled = false;
    const timer = setInterval(async () => {
      if (busy || peerRef.current !== pc) return; busy = true;
      try {
        const reports = await pc.getStats();
        if (!cancelled && peerRef.current === pc) console.info('CipherLink audio diagnostics', JSON.stringify({ ...audioDiagnostics(reports), localEnabled: streamRef.current?.getAudioTracks()[0]?.enabled, remoteEnabled: remote?.getAudioTracks()[0]?.enabled, cameraEnabled: streamRef.current?.getVideoTracks()[0]?.enabled, speaker: speakerRef.current }));
      } catch { /* Connection may close while a stats request is in flight. */ }
      finally { busy = false; }
    }, 3000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [status, call?.id, remote]);
  const start = async (peer: User, kind: 'voice' | 'video') => {
    if (callRef.current || starting.current) return;
    starting.current = true;
    try { await trustContact(server, session!.user.username, peer.id, peer.publicKey); const result = await signal<Call>('call:start', { peerId: peer.id, kind }); setCurrent(result); setStatus('Calling…'); }
    finally { starting.current = false; }
  };
  const accept = async () => {
    const current = callRef.current; if (!current) return;
    try { await trustContact(server, session!.user.username, current.peer.id, current.peer.publicKey); setStatus('Connecting…'); await prepare(current); await signal('call:accept', { callId: current.id }); }
    catch (error) { if (callRef.current?.id === current.id) fail(error); }
  };
  const decline = () => { if (callRef.current) void signal('call:reject', { callId: callRef.current.id }).catch(() => {}); cleanup(); };
  const toggleMute = () => { mutedRef.current = !mutedRef.current; streamRef.current?.getAudioTracks().forEach(t => { t.enabled = !mutedRef.current; }); setMuted(mutedRef.current); };
  const toggleSpeaker = () => { speakerRef.current = !speakerRef.current; setSpeaker(speakerRef.current); if (audioOwner.current) InCallManager.setForceSpeakerphoneOn(speakerRef.current); };
  const toggleCamera = () => { cameraRef.current = !cameraRef.current; streamRef.current?.getVideoTracks().forEach(t => { t.enabled = cameraRef.current; }); setCamera(cameraRef.current); };
  const switchCamera = () => streamRef.current?.getVideoTracks().forEach(t => t._switchCamera());
  return <Context.Provider value={{ call, status, local, remote, muted, camera, speaker, seconds, start, accept, decline, end, toggleMute, toggleSpeaker, toggleCamera, switchCamera }}>{children}</Context.Provider>;
}
