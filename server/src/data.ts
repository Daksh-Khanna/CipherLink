import {
  Prisma,
  type PrismaClient,
  type User,
  type PublicEncryptionKey,
  type Message,
} from '@prisma/client';
import { envelopeSchema } from '@cipherlink/shared';
import { ApiError } from './errors';
export const userInclude = { key: true } as const;
export const publicUser = (user: User & { key: PublicEncryptionKey | null }) => ({
  id: user.id,
  username: user.username,
  displayName: user.displayName,
  publicKey: user.key!.publicKey,
});
export async function membership(db: PrismaClient, userId: string, conversationId: string) {
  const conversation = await db.conversation.findFirst({
    where: { id: conversationId, participants: { some: { userId } } },
    include: { participants: { include: { user: { include: userInclude } } } },
  });
  if (!conversation) throw new ApiError(404, 'Conversation not found.');
  return conversation;
}
export async function storeMessage(db: PrismaClient, senderId: string, raw: unknown) {
  const envelope = envelopeSchema.parse(raw);
  const conversation = await membership(db, senderId, envelope.conversationId);
  const sender = conversation.participants.find((p) => p.userId === senderId)!.user;
  const recipient = conversation.participants.find((p) => p.userId !== senderId)!.user;
  if (
    envelope.senderKey !== sender.key!.publicKey ||
    envelope.recipientKey !== recipient.key!.publicKey
  )
    throw new ApiError(409, 'Identity key mismatch. Verify contact identity.');
  const reuse = (previous: Message) => {
    if (
      previous.senderId !== senderId ||
      envelopeSchema.keyof().options.some((key) => previous[key] !== envelope[key])
    )
      throw new ApiError(409, 'Message ID already used.');
    return { message: previous, recipientId: recipient.id };
  };
  const previous = await db.message.findUnique({ where: { id: envelope.id } });
  if (previous) return reuse(previous);
  try {
    const message = await db.message.create({ data: { ...envelope, senderId } });
    return { message, recipientId: recipient.id };
  } catch (error) {
    // Another retry may insert after our lookup. Reuse only an exact match;
    // a colliding ID must never overwrite an existing encrypted envelope.
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002')
      throw error;
    const stored = await db.message.findUnique({ where: { id: envelope.id } });
    if (!stored) throw error;
    return reuse(stored);
  }
}
