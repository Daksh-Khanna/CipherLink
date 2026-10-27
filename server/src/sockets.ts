import { randomUUID } from 'node:crypto';
import type { Server, Socket } from 'socket.io';
import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { membership, publicUser, storeMessage, userInclude } from './data';
import type { authService } from './auth';
import type { config } from './config';

type ActiveCall = { id: string; caller: string; callee: string; callerSocket: string; calleeSocket?: string; kind: 'voice' | 'video'; accepted: boolean; timer: ReturnType<typeof setTimeout> };
export function setupSockets(io: Server, db: PrismaClient, auth: ReturnType<typeof authService>, settings: ReturnType<typeof config>) {
  const calls = new Map<string, ActiveCall>();
  const busy = (id: string) => [...calls.values()].some(c => c.caller === id || c.callee === id);
  const finish = (call: ActiveCall, reason: string) => {
    clearTimeout(call.timer); calls.delete(call.id);
    io.to(`user:${call.caller}`).to(`user:${call.callee}`).emit('call:ended', { callId: call.id, reason });
  };
  io.use(async (socket, next) => {
    try {
      if (settings.ALLOW_INSECURE_HTTP !== 'true' && !('encrypted' in socket.request.socket) && !(process.env.TRUST_PROXY === '1' && socket.handshake.headers['x-forwarded-proto'] === 'https')) throw new Error('HTTPS required.');
      socket.data.identity = await auth.verify(socket.handshake.auth.token);
      next();
    } catch { next(new Error('Authentication required.')); }
  });
  const ownedCall = (socket: Socket, id: string) => {
    const call = calls.get(id);
    if (!call || (call.callerSocket !== socket.id && call.calleeSocket !== socket.id)) throw new Error('Call is not active on this device.');
    return call;
  };
  io.on('connection', socket => {
    const { userId, sessionId, expiresAt } = socket.data.identity;
    const expirationTimer = setTimeout(() => socket.disconnect(true), Math.max(1, expiresAt - Date.now()));
    socket.join(`user:${userId}`); socket.join(`session:${sessionId}`);
    // Presence is sent only to contacts with an existing conversation.
    const presence = async (online: boolean) => {
      const contacts = await db.conversationParticipant.findMany({ where: { conversation: { participants: { some: { userId } } }, userId: { not: userId } } });
      contacts.forEach(p => io.to(`user:${p.userId}`).emit('presence', { userId, online }));
    };
    void presence(true).catch(() => {});
    let quota = 0; let quotaStart = Date.now();
    const on = (event: string, handler: (data: any) => Promise<unknown>) => socket.on(event, async (data, ack) => {
      const reply = typeof ack === 'function' ? ack : () => {};
      try {
        if (Date.now() - quotaStart > 60000) { quota = 0; quotaStart = Date.now(); }
        if (++quota > 600) throw new Error('Too many events. Try again shortly.');
        // Session revocation and expiry apply to every event, not just connection.
        await auth.verify(socket.handshake.auth.token);
        reply({ ok: true, data: await handler(data) });
      } catch (error) {
        reply({ ok: false, error: error instanceof z.ZodError ? 'Invalid event payload.' : error instanceof Error ? error.message : 'Event failed.' });
      }
    });
    on('message:send', async data => {
      const { message, recipientId } = await storeMessage(db, userId, data);
      io.to(`user:${recipientId}`).to(`user:${userId}`).emit('message:new', message);
      return message;
    });
    on('message:delivered', async data => {
      const { id } = z.object({ id: z.string().uuid() }).strict().parse(data);
      const message = await db.message.findUnique({ where: { id } });
      if (!message || message.senderId === userId) throw new Error('Message not found.');
      await membership(db, userId, message.conversationId);
      const updated = message.deliveredAt ? message : await db.message.update({ where: { id }, data: { deliveredAt: new Date() } });
      io.to(`user:${message.senderId}`).emit('message:delivery', { id, deliveredAt: updated.deliveredAt });
      return updated;
    });
    on('typing', async data => {
      const input = z.object({ conversationId: z.string().uuid(), active: z.boolean() }).strict().parse(data);
      const c = await membership(db, userId, input.conversationId);
      c.participants.filter(p => p.userId !== userId).forEach(p => io.to(`user:${p.userId}`).emit('typing', { ...input, userId }));
    });
    on('call:start', async data => {
      const { peerId, kind } = z.object({ peerId: z.string().uuid(), kind: z.enum(['voice', 'video']) }).strict().parse(data);
      if (peerId === userId) throw new Error('Cannot call yourself.');
      if (busy(userId) || busy(peerId)) throw new Error('One of you is already in a call.');
      if (!io.sockets.adapter.rooms.get(`user:${peerId}`)?.size) throw new Error('Contact is offline.');
      const peer = await db.user.findUnique({ where: { id: peerId }, include: userInclude });
      const caller = await db.user.findUniqueOrThrow({ where: { id: userId }, include: userInclude });
      if (!peer) throw new Error('Contact not found.');
      // Recheck after database awaits to prevent simultaneous starts racing.
      if (busy(userId) || busy(peerId)) throw new Error('One of you is already in a call.');
      const id = randomUUID();
      const call: ActiveCall = { id, caller: userId, callee: peerId, callerSocket: socket.id, kind, accepted: false, timer: setTimeout(() => finish(call, 'No answer'), 30000) };
      calls.set(id, call);
      io.to(`user:${peerId}`).emit('call:incoming', { id, peer: publicUser(caller), kind, incoming: true });
      return { id, peer: publicUser(peer), kind, incoming: false };
    });
    on('call:accept', async data => {
      const { callId } = z.object({ callId: z.string().uuid() }).strict().parse(data);
      const call = calls.get(callId);
      if (!call || call.callee !== userId || call.accepted) throw new Error('Call no longer available.');
      call.accepted = true; call.calleeSocket = socket.id; clearTimeout(call.timer);
      call.timer = setTimeout(() => finish(call, 'Call duration limit reached'), 2 * 60 * 60 * 1000);
      io.to(call.callerSocket).to(socket.id).emit('call:accepted', { callId });
      socket.to(`user:${userId}`).emit('call:ended', { callId, reason: 'Accepted on another connection' });
    });
    on('call:reject', async data => {
      const { callId } = z.object({ callId: z.string().uuid() }).strict().parse(data);
      const call = calls.get(callId);
      if (!call || call.callee !== userId || call.accepted) throw new Error('Call not available.');
      finish(call, 'Call declined');
    });
    on('call:end', async data => {
      const { callId } = z.object({ callId: z.string().uuid() }).strict().parse(data);
      finish(ownedCall(socket, callId), 'Call ended');
    });
    for (const event of ['call:offer', 'call:answer', 'call:ice']) {
      on(event, async raw => {
        const input = z.object({ callId: z.string().uuid(), payload: z.unknown() }).strict().parse(raw);
        const call = ownedCall(socket, input.callId);
        if (!call.accepted) throw new Error('Call has not been accepted.');
        if (event === 'call:offer' && call.callerSocket !== socket.id) throw new Error('Only caller can offer.');
        if (event === 'call:answer' && call.calleeSocket !== socket.id) throw new Error('Only recipient can answer.');
        const payload = event === 'call:ice'
          ? z.object({ candidate: z.string().max(8000), sdpMid: z.string().nullable().optional(), sdpMLineIndex: z.number().int().nullable().optional() }).strict().parse(input.payload)
          : z.object({ type: z.literal(event === 'call:offer' ? 'offer' : 'answer'), sdp: z.string().min(1).max(80000) }).strict().parse(input.payload);
        io.to(socket.id === call.callerSocket ? call.calleeSocket! : call.callerSocket).emit(event, { callId: call.id, payload });
      });
    }
    socket.on('disconnect', () => {
      clearTimeout(expirationTimer);
      for (const call of calls.values()) if (call.callerSocket === socket.id || call.calleeSocket === socket.id || (call.callee === userId && !io.sockets.adapter.rooms.get(`user:${userId}`)?.size)) finish(call, 'Contact disconnected');
      if (!io.sockets.adapter.rooms.get(`user:${userId}`)?.size) void presence(false).catch(() => {});
    });
  });
  return () => { for (const call of calls.values()) clearTimeout(call.timer); calls.clear(); };
}
