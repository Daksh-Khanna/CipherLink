import nacl from 'tweetnacl';
import { decodeBase64, encodeBase64, decodeUTF8, encodeUTF8 } from 'tweetnacl-util';
import type { Envelope } from './index';

export const generateIdentity = () => {
  const keys = nacl.box.keyPair();
  return { publicKey: encodeBase64(keys.publicKey), secretKey: encodeBase64(keys.secretKey) };
};
// Native startup installs Expo's secure random source before any key generation.
export const setSecureRandom = (random: (length: number) => Uint8Array) => nacl.setPRNG((out, n) => out.set(random(n)));
export function encryptMessage(text: string, meta: Pick<Envelope, 'id' | 'conversationId'>,
  identity: { publicKey: string; secretKey: string }, recipientKey: string): Envelope {
  if (!text.trim() || text.length > 8000) throw new Error('Message must contain 1–8000 characters.');
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  // Bind routing and identity metadata inside the authenticated plaintext.
  const payload = JSON.stringify({ ...meta, senderKey: identity.publicKey, recipientKey, text });
  return { ...meta, senderKey: identity.publicKey, recipientKey, nonce: encodeBase64(nonce),
    ciphertext: encodeBase64(nacl.box(decodeUTF8(payload), nonce, decodeBase64(recipientKey), decodeBase64(identity.secretKey))),
    algorithm: 'curve25519-xsalsa20-poly1305-v1' };
}
export function decryptMessage(message: Envelope, identity: { publicKey: string; secretKey: string }): string {
  if (message.algorithm !== 'curve25519-xsalsa20-poly1305-v1') throw new Error('Unsupported encryption version.');
  if (identity.publicKey !== message.senderKey && identity.publicKey !== message.recipientKey) throw new Error('This message belongs to another identity.');
  const other = identity.publicKey === message.senderKey ? message.recipientKey : message.senderKey;
  const opened = nacl.box.open(decodeBase64(message.ciphertext), decodeBase64(message.nonce), decodeBase64(other), decodeBase64(identity.secretKey));
  if (!opened) throw new Error('Message authentication failed.');
  const payload = JSON.parse(encodeUTF8(opened));
  for (const field of ['id', 'conversationId', 'senderKey', 'recipientKey'] as const) {
    if (payload[field] !== message[field]) throw new Error('Message metadata was modified.');
  }
  if (typeof payload.text !== 'string') throw new Error('Invalid encrypted message.');
  return payload.text;
}
export function fingerprint(publicKey: string): string {
  return Array.from(nacl.hash(decodeBase64(publicKey)).slice(0, 32), b => b.toString(16).padStart(2, '0')).join('').match(/.{1,4}/g)!.join(' ');
}
