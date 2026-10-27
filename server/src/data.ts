import type { PrismaClient, User, PublicEncryptionKey } from '@prisma/client';
import { envelopeSchema, type Envelope } from '@cipherlink/shared';
export const userInclude = { key: true } as const;
export const publicUser = (user: User & { key: PublicEncryptionKey | null }) => ({ id: user.id, username: user.username, displayName: user.displayName, publicKey: user.key!.publicKey });
export class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }
export async function membership(db: PrismaClient, userId: string, conversationId: string) {
  const conversation = await db.conversation.findFirst({ where: { id: conversationId, participants: { some: { userId } } }, include: { participants: { include: { user: { include: userInclude } } } } });
  if (!conversation) throw new ApiError(404, 'Conversation not found.');
  return conversation;
}
export async function storeMessage(db: PrismaClient, senderId: string, raw: unknown) {
  const envelope = envelopeSchema.parse(raw);
  const conversation = await membership(db, senderId, envelope.conversationId);
  const sender = conversation.participants.find(p => p.userId === senderId)!.user;
  const recipient = conversation.participants.find(p => p.userId !== senderId)!.user;
  if (envelope.senderKey !== sender.key!.publicKey || envelope.recipientKey !== recipient.key!.publicKey) throw new ApiError(409, 'Identity key mismatch. Verify contact identity.');
  const previous = await db.message.findUnique({ where: { id: envelope.id } });
  if (previous) {
    if (previous.senderId !== senderId || Object.keys(envelope).some(k => previous[k as keyof Envelope] !== envelope[k as keyof Envelope])) throw new ApiError(409, 'Message ID already used.');
    return { message: previous, recipientId: recipient.id };
  }
  const message = await db.message.create({ data: { ...envelope, senderId } });
  return { message, recipientId: recipient.id };
}
