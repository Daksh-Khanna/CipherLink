import React from 'react';
import { Modal, Text, View } from 'react-native';
import { RTCView } from 'react-native-webrtc';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useCalls } from '../webrtc/CallProvider';
import { Avatar, Button, IconButton } from '../components/UI';
import { colors, styles } from '../theme';
export function CallScreen() {
  const c = useCalls();
  if (!c.call) return null;
  const video = c.call.kind === 'video';
  const incoming = c.status === 'Incoming call';
  return <Modal visible animationType="slide" onRequestClose={c.end}><SafeAreaView style={styles.screen}>
    {video && c.remote && <RTCView streamURL={c.remote.toURL()} objectFit="cover" style={{ position: 'absolute', inset: 0 }} />}
    <View style={{ flex: 1, padding: 26, justifyContent: 'space-between', backgroundColor: c.remote ? '#10141544' : colors.bg }}>
      <View style={{ alignItems: 'center', gap: 12 }}><View style={styles.row}><Ionicons name="shield-checkmark-outline" size={17} color={colors.accent} /><Text style={styles.label}>Encrypted {video ? 'video' : 'voice'} call</Text></View><Text style={styles.title}>{c.call.peer.displayName}</Text><Text style={styles.subtitle}>{c.status === 'Connected' ? `${Math.floor(c.seconds / 60).toString().padStart(2, '0')}:${(c.seconds % 60).toString().padStart(2, '0')}` : c.status}</Text></View>
      {(!video || !c.remote) && <View style={{ alignItems: 'center', gap: 28 }}><Avatar name={c.call.peer.displayName} size={140} /><Text style={styles.subtitle}>{incoming ? 'Someone wants to connect with you.' : 'A private space for your conversation.'}</Text></View>}
      {video && c.local && c.camera && <RTCView streamURL={c.local.toURL()} objectFit="cover" mirror style={{ position: 'absolute', right: 22, top: 155, width: 108, height: 154, borderRadius: 18, backgroundColor: colors.surface }} zOrder={1} />}
      {incoming ? <View style={{ gap: 14 }}><Button title="Accept call" onPress={() => void c.accept()} /><Button title="Decline" danger onPress={c.decline} /></View> : <View style={{ gap: 22, alignItems: 'center' }}><View style={{ ...styles.row, gap: 22 }}><IconButton name={c.muted ? 'mic-off' : 'mic'} active={c.muted} label={c.muted ? 'Unmute microphone' : 'Mute microphone'} onPress={c.toggleMute} />{video && <><IconButton name={c.camera ? 'videocam' : 'videocam-off'} active={!c.camera} label="Toggle camera" onPress={c.toggleCamera} /><IconButton name="camera-reverse" label="Switch camera" onPress={c.switchCamera} /></>}{!video && <IconButton name={c.speaker ? 'volume-high' : 'ear-outline'} active={c.speaker} label={c.speaker ? 'Use earpiece' : 'Use speaker'} onPress={c.toggleSpeaker} />}<IconButton name="call" danger label="End call" onPress={c.end} /></View><Text style={{ ...styles.subtitle, textAlign: 'center', fontSize: 12 }}>Keep CipherLink in the foreground during calls.</Text></View>}
    </View></SafeAreaView></Modal>;
}
