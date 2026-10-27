import { z } from 'zod';
export * from './crypto';
export const algorithm = 'curve25519-xsalsa20-poly1305-v1' as const;
export const keySchema = z.string().regex(/^[A-Za-z0-9+/]{43}=$/);
export const envelopeSchema = z.object({
  id: z.string().uuid(), conversationId: z.string().uuid(),
  ciphertext: z.string().min(24).max(60000).regex(/^[A-Za-z0-9+/]+={0,2}$/),
  nonce: z.string().regex(/^[A-Za-z0-9+/]{32}$/),
  senderKey: keySchema, recipientKey: keySchema,
  algorithm: z.literal(algorithm),
}).strict();
export type Envelope = z.infer<typeof envelopeSchema>;
export type User = { id: string; username: string; displayName: string; publicKey: string; online?: boolean };
export type Message = Envelope & { senderId: string; createdAt: string; deliveredAt: string | null };
export type Conversation = { id: string; peer: User; lastMessage: Message | null; unread: number };
export type Call = { id: string; peer: User; kind: 'voice' | 'video'; incoming: boolean };
export type Ack<T = unknown> = { ok: true; data: T } | { ok: false; error: string };
