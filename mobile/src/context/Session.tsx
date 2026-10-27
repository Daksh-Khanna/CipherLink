import React, { createContext, useContext, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import type { User } from '@cipherlink/shared';
import type { Socket } from 'socket.io-client';
import type { AxiosInstance } from 'axios';
import { createClient, connectSocket, validateServerUrl } from '../services/client';
import { getSecure, saveSecure, deleteSecure, loadIdentity, registrationIdentity, linkServerAddress, type DeviceIdentity } from '../services/storage';
import { colors } from '../theme';
type Session = { user: User; token: string; identity: DeviceIdentity; api: AxiosInstance; socket: Socket };
type State = { session: Session | null; server: string; online: boolean; setServer: (s: string) => Promise<void>; reconnectServer: (s: string) => Promise<void>; login: (username: string, password: string, displayName?: string) => Promise<void>; logout: () => Promise<void> };
const Context = createContext<State>(null!);
export const useSession = () => useContext(Context);
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [server, setServerState] = useState(process.env.EXPO_PUBLIC_API_URL || '');
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(false);
  const activate = (url: string, token: string, user: User, identity: DeviceIdentity) => {
    const socket = connectSocket(url, token);
    setSession({ user, token, identity, api: createClient(url, token), socket });
  };
  useEffect(() => {
    (async () => {
      const url = await getSecure('server') || process.env.EXPO_PUBLIC_API_URL || '';
      setServerState(url);
      const raw = await getSecure('session');
      if (raw && url) {
        const stored = JSON.parse(raw);
        const identity = await loadIdentity(url, stored.user.username);
        if (identity && identity.publicKey === stored.user.publicKey) activate(url, stored.token, stored.user, identity);
        else await deleteSecure('session');
      }
    })().catch(() => {}).finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (!session) { setOnline(false); return; }
    setOnline(false);
    const { socket, api } = session;
    const expire = async () => { socket.disconnect(); await deleteSecure('session'); setSession(null); };
    const id = api.interceptors.response.use(r => r, async error => { if (error.response?.status === 401) await expire(); return Promise.reject(error); });
    socket.on('connect', () => { setOnline(true); api.get('/me').catch(() => {}); });
    socket.on('disconnect', reason => { setOnline(false); if (reason === 'io server disconnect') void expire(); });
    socket.on('connect_error', (e: Error) => { if (e.message === 'Authentication required.') void expire(); });
    socket.connect();
    return () => { api.interceptors.response.eject(id); socket.disconnect(); socket.removeAllListeners(); };
  }, [session]);
  const setServer = async (value: string) => { const url = validateServerUrl(value); await saveSecure('server', url); setServerState(url); };
  const reconnectServer = async (value: string) => {
    if (!session) throw new Error('Sign in before changing this server address.');
    const url = validateServerUrl(value);
    const { data: verified } = await createClient(url, session.token).get<User>('/me');
    if (verified.id !== session.user.id || verified.username !== session.user.username || verified.publicKey !== session.identity.publicKey) {
      throw new Error('The new address did not verify your current account. Check that it points to this CipherLink server.');
    }
    await linkServerAddress(server, url, verified.username, verified.publicKey);
    await saveSecure('server', url);
    await saveSecure('session', JSON.stringify({ token: session.token, user: verified }));
    setServerState(url);
    activate(url, session.token, verified, session.identity);
  };
  const login = async (username: string, password: string, displayName?: string) => {
    const url = validateServerUrl(server);
    const normalized = username.trim().toLowerCase();
    const identity = displayName !== undefined ? await registrationIdentity(url, normalized) : await loadIdentity(url, normalized);
    if (!identity) throw new Error('This device has no identity key for that account. Log in on the original device. Keys cannot be recovered from the server.');
    const api = createClient(url);
    const { data } = await api.post(displayName !== undefined ? '/auth/register' : '/auth/login', { username: normalized, password, ...(displayName !== undefined ? { displayName: displayName.trim(), publicKey: identity.publicKey } : {}) });
    if (data.user.publicKey !== identity.publicKey) throw new Error('Device identity differs from the registered key. Use the original device; identity was not replaced.');
    await saveSecure('session', JSON.stringify({ token: data.token, user: data.user }));
    activate(url, data.token, data.user, identity);
  };
  const logout = async () => { if (session) await session.api.post('/auth/logout'); await deleteSecure('session'); setSession(null); };
  if (loading) return <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.bg }}><ActivityIndicator color={colors.accent} /></View>;
  return <Context.Provider value={{ session, server, online, setServer, reconnectServer, login, logout }}>{children}</Context.Provider>;
}
