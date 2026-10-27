import axios from 'axios';
import { io, type Socket } from 'socket.io-client';
import type { Ack } from '@cipherlink/shared';
export function validateServerUrl(input: string) {
  const url = new URL(input.trim());
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('Enter a server origin such as https://chat.example.com or http://192.168.1.5:3000.');
  if (url.protocol === 'http:' && process.env.EXPO_PUBLIC_ALLOW_INSECURE_HTTP !== 'true') throw new Error('This build requires HTTPS.');
  return url.origin;
}
export function createClient(url: string, token?: string) {
  return axios.create({ baseURL: `${url}/api`, timeout: 15000, headers: token ? { Authorization: `Bearer ${token}` } : {} });
}
export function connectSocket(url: string, token: string): Socket { return io(url, { auth: { token }, transports: ['websocket'], reconnection: true, reconnectionDelayMax: 5000, autoConnect: false }); }
export function emitAck<T>(socket: Socket, event: string, payload: unknown): Promise<T> {
  if (!socket.connected) return Promise.reject(new Error('You are offline. Reconnect and try again.'));
  return new Promise((resolve, reject) => socket.timeout(12000).emit(event, payload, (error: Error | null, ack: Ack<T>) => {
    if (error) reject(new Error('Server did not acknowledge. Retry safely.'));
    else if (!ack?.ok) reject(new Error(ack?.error || 'Request failed.'));
    else resolve(ack.data);
  }));
}
export const errorMessage = (error: unknown): string => axios.isAxiosError(error) ? error.response?.data?.error || (error.response ? `Server returned ${error.response.status}.` : 'Cannot reach the server. Check the address and Wi-Fi connection.') : error instanceof Error ? error.message : 'Something went wrong.';
