import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { PrismaClient, Prisma } from '@prisma/client';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { keySchema } from '@cipherlink/shared';
import { authService } from './auth';
import { ApiError, membership, publicUser, userInclude } from './data';
import { setupSockets } from './sockets';
import type { config } from './config';

export function createApplication(db: PrismaClient, settings: ReturnType<typeof config>) {
  const app = express();
  const http = createServer(app);
  const io = new Server(http, { maxHttpBufferSize: 100000, cors: { origin: false } });
  const auth = authService(db, settings.JWT_SECRET);
  app.disable('x-powered-by');
  app.use(helmet(), cors({ origin: false }), express.json({ limit: '80kb' }));
  // Set a trusted proxy at deployment if TLS terminates at a reverse proxy.
  if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);
  app.use((req, res, next) => {
    if (settings.ALLOW_INSECURE_HTTP !== 'true' && !req.secure) { res.status(400).json({ error: 'HTTPS is required.' }); return; }
    next();
  });
  app.use('/api', rateLimit({ windowMs: 60000, limit: 240, standardHeaders: 'draft-8', legacyHeaders: false }));
  app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'CipherLink' }));
  const credentials = z.object({ username: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,24}$/), password: z.string().min(10).max(72).refine(p => Buffer.byteLength(p) <= 72, 'Password must be at most 72 UTF-8 bytes.') });
  const authLimit = rateLimit({ windowMs: 15 * 60000, limit: process.env.NODE_ENV === 'test' ? 1000 : 30, standardHeaders: 'draft-8', legacyHeaders: false });
  app.post('/api/auth/register', authLimit, async (req, res) => {
    const input = credentials.extend({ displayName: z.string().trim().min(1).max(60), publicKey: keySchema }).strict().parse(req.body);
    const hash = await bcrypt.hash(input.password, 12);
    const user = await db.user.create({ data: { username: input.username, displayName: input.displayName, passwordHash: hash, key: { create: { publicKey: input.publicKey } } }, include: userInclude });
    res.status(201).json({ token: await auth.issue(user.id), user: publicUser(user) });
  });
  app.post('/api/auth/login', authLimit, async (req, res) => {
    const input = credentials.strict().parse(req.body);
    const user = await db.user.findUnique({ where: { username: input.username }, include: userInclude });
    // A fixed-cost dummy comparison limits username timing leakage.
    const valid = await bcrypt.compare(input.password, user?.passwordHash || '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxAwGLG5WYzR.dXWvD1NwCOGmK.');
    if (!user || !valid) throw new ApiError(401, 'Invalid username or password.');
    res.json({ token: await auth.issue(user.id), user: publicUser(user) });
  });
  app.use('/api', auth.middleware);
  app.get('/api/me', async (req, res) => res.json(publicUser((await db.user.findUniqueOrThrow({ where: { id: req.identity.userId }, include: userInclude })))));
  app.post('/api/auth/logout', async (req, res) => {
    await db.session.deleteMany({ where: { id: req.identity.sessionId } });
    io.in(`session:${req.identity.sessionId}`).disconnectSockets(true);
    res.json({ ok: true });
  });
  app.get('/api/network', (_req, res) => res.json({ iceServers: settings.iceServers }));
  app.get('/api/users/search', async (req, res) => {
    const q = z.string().trim().max(60).parse(req.query.q ?? '');
    const users = await db.user.findMany({ where: { id: { not: req.identity.userId }, OR: [{ username: { contains: q.toLowerCase() } }, { displayName: { contains: q } }] }, include: userInclude, take: 30, orderBy: { username: 'asc' } });
    res.json(users.map(u => ({ ...publicUser(u), online: (io.sockets.adapter.rooms.get(`user:${u.id}`)?.size || 0) > 0 })));
  });
  app.get('/api/users/:id', async (req, res) => {
    const user = await db.user.findUnique({ where: { id: z.string().uuid().parse(req.params.id) }, include: userInclude });
    if (!user) throw new ApiError(404, 'User not found.');
    res.json({ ...publicUser(user), online: (io.sockets.adapter.rooms.get(`user:${user.id}`)?.size || 0) > 0 });
  });
  app.post('/api/conversations', async (req, res) => {
    const { userId } = z.object({ userId: z.string().uuid() }).strict().parse(req.body);
    if (userId === req.identity.userId) throw new ApiError(400, 'Choose another user.');
    const peer = await db.user.findUnique({ where: { id: userId }, include: userInclude });
    if (!peer) throw new ApiError(404, 'User not found.');
    const pairKey = [userId, req.identity.userId].sort().join(':');
    const conversation = await db.conversation.upsert({ where: { pairKey }, create: { pairKey, participants: { create: [{ userId }, { userId: req.identity.userId }] } }, update: {} });
    res.json({ id: conversation.id, peer: publicUser(peer), lastMessage: null, unread: 0 });
  });
  app.get('/api/conversations', async (req, res) => {
    const list = await db.conversation.findMany({ where: { participants: { some: { userId: req.identity.userId } } }, include: { participants: { include: { user: { include: userInclude } } }, messages: { orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 1 } } });
    const result = await Promise.all(list.map(async c => {
      const mine = c.participants.find(p => p.userId === req.identity.userId)!;
      const peer = c.participants.find(p => p.userId !== req.identity.userId)!.user;
      const unread = await db.message.count({ where: { conversationId: c.id, senderId: { not: req.identity.userId }, createdAt: { gt: mine.readAt } } });
      return { id: c.id, peer: { ...publicUser(peer), online: (io.sockets.adapter.rooms.get(`user:${peer.id}`)?.size || 0) > 0 }, lastMessage: c.messages[0] || null, unread };
    }));
    res.json(result.sort((a, b) => (b.lastMessage?.createdAt.getTime() || 0) - (a.lastMessage?.createdAt.getTime() || 0)));
  });
  app.get('/api/conversations/:id/messages', async (req, res) => {
    const id = z.string().uuid().parse(req.params.id);
    await membership(db, req.identity.userId, id);
    const cursor = z.string().uuid().optional().parse(req.query.before);
    if (cursor && !(await db.message.findFirst({ where: { id: cursor, conversationId: id } }))) throw new ApiError(400, 'Invalid message cursor.');
    const messages = await db.message.findMany({ where: { conversationId: id }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 50, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) });
    res.json(messages.reverse());
  });
  app.post('/api/conversations/:id/read', async (req, res) => {
    const id = z.string().uuid().parse(req.params.id);
    await membership(db, req.identity.userId, id);
    await db.conversationParticipant.update({ where: { conversationId_userId: { conversationId: id, userId: req.identity.userId } }, data: { readAt: new Date() } });
    res.json({ ok: true });
  });
  app.use((_req, res) => res.status(404).json({ error: 'Endpoint not found.' }));
  app.use(((err, _req, res, _next) => {
    if (err instanceof z.ZodError) { res.status(400).json({ error: err.issues[0]?.message || 'Invalid input.' }); return; }
    if (err instanceof ApiError) { res.status(err.status).json({ error: err.message }); return; }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') { res.status(409).json({ error: 'Username or identity key already registered.' }); return; }
    if (err instanceof SyntaxError) { res.status(400).json({ error: 'Invalid JSON.' }); return; }
    console.error('Request failed:', err instanceof Error ? err.name : 'Unknown error');
    res.status(500).json({ error: 'The server could not complete this request.' });
  }) as express.ErrorRequestHandler);
  const closeSockets = setupSockets(io, db, auth, settings);
  return { app, http, io, closeSockets };
}
