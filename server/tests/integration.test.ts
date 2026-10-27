import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { io, type Socket } from 'socket.io-client';
import { PrismaClient } from '@prisma/client';
import { createApplication } from '../src/app';
import { generateIdentity, encryptMessage, decryptMessage, type Ack, type Message, type Call } from '@cipherlink/shared';

const temp = mkdtempSync(join(tmpdir(), 'cipherlink-test-'));
const database = join(temp, 'integration.db');
const databaseUrl = `file:${database.replaceAll('\\', '/')}`;
const db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
const instance = createApplication(db, { JWT_SECRET: randomBytes(48).toString('hex'), HOST: '127.0.0.1', PORT: 0, ALLOW_INSECURE_HTTP: 'true', iceServers: [] });
let url: string;
const sockets: Socket[] = [];
const alice = { identity: generateIdentity(), token: '', id: '' };
const bob = { identity: generateIdentity(), token: '', id: '' };
const eve = { identity: generateIdentity(), token: '', id: '' };
let conversationId: string;
let a: Socket, b: Socket, e: Socket;
const password = randomBytes(20).toString('hex');
async function request(path: string, token?: string, body?: unknown, method?: string) {
  return fetch(`${url}/api${path}`, { method: method || (body ? 'POST' : 'GET'), headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
}
function event<T>(socket: Socket, name: string): Promise<T> { return new Promise((resolve, reject) => { const timer = setTimeout(() => { socket.off(name, listener); reject(new Error(`Timed out waiting for ${name}`)); }, 4000); const listener = (data: T) => { clearTimeout(timer); resolve(data); }; socket.once(name, listener); }); }
function ack<T>(socket: Socket, name: string, data: unknown): Promise<Ack<T>> { return new Promise((resolve, reject) => socket.timeout(4000).emit(name, data, (error: Error | null, result: Ack<T>) => error ? reject(error) : resolve(result))); }
function data<T>(result: Ack<T>): T { if (!result.ok) assert.fail(result.error); return result.data; }
async function connect(token: string) { const socket = io(url, { auth: { token }, transports: ['websocket'], forceNew: true, autoConnect: false, reconnection: false }); sockets.push(socket); const connected = event(socket, 'connect'); socket.connect(); await connected; return socket; }
before(async () => {
  process.env.NODE_ENV = 'test';
  // Windows Prisma migrate requires an existing SQLite file on this environment.
  writeFileSync(database, '');
  execFileSync(process.execPath, [resolve('../node_modules/prisma/build/index.js'), 'migrate', 'deploy'], { cwd: resolve('.'), env: { ...process.env, DATABASE_URL: databaseUrl }, stdio: 'pipe' });
  await new Promise<void>(r => instance.http.listen(0, '127.0.0.1', r));
  url = `http://127.0.0.1:${(instance.http.address() as { port: number }).port}`;
}, { timeout: 30000 });
after(async () => {
  sockets.forEach(s => s.disconnect()); instance.closeSockets();
  await new Promise<void>(r => instance.io.close(() => r()));
  await db.$disconnect(); rmSync(temp, { recursive: true, force: true });
});
test('health, three real registrations, password hashes and public-only identities', async () => {
  assert.equal((await request('/health')).status, 200);
  for (const [name, account] of [['alice', alice], ['bob', bob], ['eve', eve]] as const) {
    const response = await request('/auth/register', undefined, { username: name, displayName: name.toUpperCase(), password, publicKey: account.identity.publicKey });
    assert.equal(response.status, 201); const result = await response.json(); account.id = result.user.id; account.token = result.token;
    assert.equal(result.user.passwordHash, undefined); assert.equal(result.user.secretKey, undefined);
  }
  const user = await db.user.findUniqueOrThrow({ where: { id: alice.id } });
  assert.notEqual(user.passwordHash, password); assert.ok(user.passwordHash.startsWith('$2b$12$'));
});
test('duplicate username, invalid password, malformed key and unauthorized access rejected', async () => {
  assert.equal((await request('/auth/register', undefined, { username: 'alice', displayName: 'Alice', password, publicKey: generateIdentity().publicKey })).status, 409);
  assert.equal((await request('/auth/login', undefined, { username: 'alice', password: 'wrong-password' })).status, 401);
  assert.equal((await request('/conversations')).status, 401);
  assert.equal((await request('/users/search', 'invalid-jwt')).status, 401);
  assert.equal((await request('/auth/register', undefined, { username: 'invalid', displayName: 'Invalid', password, publicKey: 'not-a-key' })).status, 400);
});
test('login, discovery, idempotent conversation creation, history authorization', async () => {
  const login = await request('/auth/login', undefined, { username: 'alice', password }); assert.equal(login.status, 200);
  alice.token = (await login.json()).token;
  const search = await (await request('/users/search?q=bob', alice.token)).json(); assert.equal(search[0].id, bob.id); assert.equal(search[0].passwordHash, undefined);
  const c = await (await request('/conversations', alice.token, { userId: bob.id })).json(); conversationId = c.id;
  assert.equal((await (await request('/conversations', bob.token, { userId: alice.id })).json()).id, conversationId);
  assert.equal((await request(`/conversations/${conversationId}/messages`, eve.token)).status, 404);
  a = await connect(alice.token); b = await connect(bob.token); e = await connect(eve.token);
});
test('invalid JWT socket handshake fails', async () => {
  const socket = io(url, { auth: { token: 'invalid' }, transports: ['websocket'], reconnection: false, autoConnect: false }); sockets.push(socket);
  const error = event<Error>(socket, 'connect_error'); socket.connect(); assert.match((await error).message, /Authentication/);
});
const sentence = 'Hello, can you hear me? Private integration fixture.';
let envelope: ReturnType<typeof encryptMessage>;
test('real-time encrypted delivery, decryption, duplicate acknowledgments and ciphertext-only database', async () => {
  envelope = encryptMessage(sentence, { id: randomUUID(), conversationId }, alice.identity, bob.identity.publicKey);
  const received = event<Message>(b, 'message:new');
  const persisted = data(await ack<Message>(a, 'message:send', envelope));
  assert.equal(decryptMessage(await received, bob.identity), sentence);
  assert.equal(persisted.senderId, alice.id);
  data(await ack(a, 'message:send', envelope));
  assert.equal(await db.message.count({ where: { id: envelope.id } }), 1);
  const stored = await db.message.findUniqueOrThrow({ where: { id: envelope.id } });
  assert.ok(!JSON.stringify(stored).includes(sentence));
  assert.ok(!readFileSync(database).includes(Buffer.from(sentence)));
  assert.equal(decryptMessage({ ...envelope, ciphertext: stored.ciphertext, nonce: stored.nonce }, alice.identity), sentence);
  const delivery = event<{ id: string }>(a, 'message:delivery'); data(await ack(b, 'message:delivered', { id: envelope.id })); assert.equal((await delivery).id, envelope.id);
});
test('plaintext payloads, arbitrary sender identity, identity mismatch and unauthorized messages rejected', async () => {
  assert.equal((await ack(a, 'message:send', { ...envelope, text: sentence })).ok, false);
  assert.equal((await ack(a, 'message:send', { ...envelope, senderId: bob.id })).ok, false);
  assert.equal((await ack(a, 'message:send', { ...envelope, id: randomUUID(), recipientKey: eve.identity.publicKey })).ok, false);
  assert.equal((await ack(e, 'message:send', envelope)).ok, false);
  assert.equal((await ack(e, 'message:delivered', { id: envelope.id })).ok, false);
  assert.equal((await ack(e, 'typing', { conversationId, active: true })).ok, false);
});
test('offline persistence, reconnect history, reply and read state', async () => {
  const disconnected = event(b, 'disconnect'); b.disconnect(); await disconnected;
  const offline = encryptMessage('Offline message', { id: randomUUID(), conversationId }, alice.identity, bob.identity.publicKey);
  data(await ack(a, 'message:send', offline));
  b = await connect(bob.token);
  const history: Message[] = await (await request(`/conversations/${conversationId}/messages`, bob.token)).json();
  assert.equal(decryptMessage(history.find(m => m.id === offline.id)!, bob.identity), 'Offline message');
  const received = event<Message>(a, 'message:new');
  data(await ack(b, 'message:send', encryptMessage('I hear you.', { id: randomUUID(), conversationId }, bob.identity, alice.identity.publicKey)));
  assert.equal(decryptMessage(await received, alice.identity), 'I hear you.');
  await request(`/conversations/${conversationId}/read`, bob.token, {});
  const conversations = await (await request('/conversations', bob.token)).json(); assert.equal(conversations[0].unread, 0);
});
test('voice call initiation, acceptance, SDP/ICE relay, authorization and termination', async () => {
  const incoming = event<Call>(b, 'call:incoming'); const call = data(await ack<Call>(a, 'call:start', { peerId: bob.id, kind: 'voice' }));
  assert.equal((await incoming).peer.id, alice.id);
  assert.equal((await ack(e, 'call:accept', { callId: call.id })).ok, false);
  assert.equal((await ack(e, 'call:offer', { callId: call.id, payload: { type: 'offer', sdp: 'test' } })).ok, false);
  const accepted = event(a, 'call:accepted'); data(await ack(b, 'call:accept', { callId: call.id })); await accepted;
  const offer = event<any>(b, 'call:offer'); data(await ack(a, 'call:offer', { callId: call.id, payload: { type: 'offer', sdp: 'signaling-fixture-no-media' } })); assert.equal((await offer).payload.type, 'offer');
  const answer = event<any>(a, 'call:answer'); data(await ack(b, 'call:answer', { callId: call.id, payload: { type: 'answer', sdp: 'signaling-fixture-no-media' } })); assert.equal((await answer).payload.type, 'answer');
  const ice = event<any>(b, 'call:ice'); data(await ack(a, 'call:ice', { callId: call.id, payload: { candidate: 'candidate:signaling-fixture', sdpMid: '0', sdpMLineIndex: 0 } })); assert.equal((await ice).callId, call.id);
  const ended = event<any>(b, 'call:ended'); data(await ack(a, 'call:end', { callId: call.id })); assert.equal((await ended).reason, 'Call ended');
});
test('video signaling, busy rejection, decline, offline handling and disconnect cleanup', async () => {
  const incoming = event<Call>(b, 'call:incoming'); const call = data(await ack<Call>(a, 'call:start', { peerId: bob.id, kind: 'video' })); assert.equal((await incoming).kind, 'video');
  assert.equal((await ack(e, 'call:start', { peerId: bob.id, kind: 'voice' })).ok, false);
  const ended = event<any>(a, 'call:ended'); data(await ack(b, 'call:reject', { callId: call.id })); assert.equal((await ended).reason, 'Call declined');
  data(await ack<Call>(a, 'call:start', { peerId: bob.id, kind: 'video' }));
  const disconnected = event<any>(a, 'call:ended'); b.disconnect(); assert.equal((await disconnected).reason, 'Contact disconnected');
  assert.equal((await ack(a, 'call:start', { peerId: bob.id, kind: 'voice' })).ok, false);
});
test('logout revokes REST and active socket sessions; re-login retains original identity', async () => {
  const disconnected = event(a, 'disconnect'); assert.equal((await request('/auth/logout', alice.token, {})).status, 200); await disconnected;
  assert.equal((await request('/me', alice.token)).status, 401);
  const result = await (await request('/auth/login', undefined, { username: 'alice', password })).json();
  assert.equal(result.user.publicKey, alice.identity.publicKey);
  const history = await (await request(`/conversations/${conversationId}/messages`, result.token)).json();
  assert.equal(decryptMessage(history.find((m: Message) => m.id === envelope.id), alice.identity), sentence);
});
test('session expiry rejects REST and socket events even for a previously connected client', async () => {
  const login = await (await request('/auth/login', undefined, { username: 'eve', password })).json();
  const socket = await connect(login.token);
  await db.session.updateMany({ where: { userId: eve.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
  assert.equal((await request('/me', login.token)).status, 401);
  assert.equal((await ack(socket, 'call:start', { peerId: bob.id, kind: 'voice' })).ok, false);
});
test('history pagination has no gaps or duplicates after more than 50 encrypted messages', async () => {
  const login = await (await request('/auth/login', undefined, { username: 'alice', password })).json();
  const socket = await connect(login.token);
  for (let i = 0; i < 52; i++) {
    data(await ack(socket, 'message:send', encryptMessage(`Page fixture ${i}`, { id: randomUUID(), conversationId }, alice.identity, bob.identity.publicKey)));
  }
  const recent: Message[] = await (await request(`/conversations/${conversationId}/messages`, login.token)).json();
  assert.equal(recent.length, 50);
  const older: Message[] = await (await request(`/conversations/${conversationId}/messages?before=${recent[0].id}`, login.token)).json();
  const ids = [...older, ...recent].map(m => m.id);
  assert.equal(new Set(ids).size, await db.message.count({ where: { conversationId } }));
  assert.equal(ids.length, new Set(ids).size);
  assert.equal(decryptMessage(older.find(m => m.id === envelope.id)!, alice.identity), sentence);
  assert.equal((await request(`/conversations/${conversationId}/messages?before=${randomUUID()}`, login.token)).status, 400);
});
