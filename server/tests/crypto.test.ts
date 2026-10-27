import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { encryptMessage, decryptMessage, generateIdentity, fingerprint } from '@cipherlink/shared';
import { decodeBase64, encodeBase64 } from 'tweetnacl-util';
test('authenticated encryption: recipient and sender can decrypt; ciphertext differs from plaintext', () => {
  const alice = generateIdentity(),
    bob = generateIdentity();
  const text = 'Hello, can you hear me? 🔐';
  const message = encryptMessage(
    text,
    { id: randomUUID(), conversationId: randomUUID() },
    alice,
    bob.publicKey,
  );
  assert.notEqual(message.ciphertext, text);
  assert.ok(!JSON.stringify(message).includes(text));
  assert.equal(decryptMessage(message, bob), text);
  assert.equal(decryptMessage(message, alice), text);
  assert.notEqual(fingerprint(alice.publicKey), fingerprint(bob.publicKey));
});
test('wrong private key, tampering, modified nonce and modified routing fail authentication', () => {
  const alice = generateIdentity(),
    bob = generateIdentity(),
    mallory = generateIdentity();
  const message = encryptMessage(
    'Sensitive text',
    { id: randomUUID(), conversationId: randomUUID() },
    alice,
    bob.publicKey,
  );
  assert.throws(() => decryptMessage(message, { ...bob, secretKey: mallory.secretKey }));
  const changed = decodeBase64(message.ciphertext);
  changed[0] ^= 1;
  assert.throws(() => decryptMessage({ ...message, ciphertext: encodeBase64(changed) }, bob));
  const nonce = decodeBase64(message.nonce);
  nonce[0] ^= 1;
  assert.throws(() => decryptMessage({ ...message, nonce: encodeBase64(nonce) }, bob));
  assert.throws(() => decryptMessage({ ...message, conversationId: randomUUID() }, bob));
});
test('same plaintext has independent random nonces; stored keys survive serialization', () => {
  const alice = generateIdentity(),
    bob = generateIdentity();
  const meta = { id: randomUUID(), conversationId: randomUUID() };
  const a = encryptMessage('Repeat', meta, alice, bob.publicKey),
    b = encryptMessage('Repeat', meta, alice, bob.publicKey);
  assert.notEqual(a.nonce, b.nonce);
  assert.notEqual(a.ciphertext, b.ciphertext);
  assert.equal(decryptMessage(a, JSON.parse(JSON.stringify(bob))), 'Repeat');
});
