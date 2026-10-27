import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createIdentityStore } from '../../mobile/src/services/identity-store';
import { generateIdentity } from '@cipherlink/shared';
function vault() {
  const values = new Map<string, string>();
  return {
    getItem: async (key: string) => values.get(key) || null,
    setItem: async (key: string, value: string) => {
      values.set(key, value);
    },
  };
}
test('network address changes preserve identity and contact trust after restart', async () => {
  const storage = vault();
  const original = createIdentityStore(storage);
  const identity = await original.registrationIdentity('http://127.0.0.1:3000', 'alice');
  const bob = generateIdentity(),
    attacker = generateIdentity();
  await original.trustContact('http://127.0.0.1:3000', 'alice', 'bob-id', bob.publicKey);
  await original.linkServerAddress(
    'http://127.0.0.1:3000',
    'https://demo.example.com',
    'alice',
    identity.publicKey,
  );
  const restarted = createIdentityStore(storage);
  assert.deepEqual(await restarted.loadIdentity('https://demo.example.com', 'ALICE'), identity);
  await restarted.trustContact('https://demo.example.com', 'alice', 'bob-id', bob.publicKey);
  await assert.rejects(
    restarted.trustContact('https://demo.example.com', 'alice', 'bob-id', attacker.publicKey),
    /identity changed/,
  );
  await restarted.linkServerAddress(
    'https://demo.example.com',
    'https://new-demo.example.com',
    'alice',
    identity.publicKey,
  );
  assert.deepEqual(await restarted.loadIdentity('https://new-demo.example.com', 'alice'), identity);
});
test('address linking rejects mismatches without overwriting existing identities', async () => {
  const store = createIdentityStore(vault());
  const first = await store.registrationIdentity('https://first.example.com', 'alice');
  const second = await store.registrationIdentity('https://second.example.com', 'alice');
  await assert.rejects(
    store.linkServerAddress(
      'https://first.example.com',
      'https://third.example.com',
      'alice',
      second.publicKey,
    ),
    /could not be verified/,
  );
  await assert.rejects(
    store.linkServerAddress(
      'https://first.example.com',
      'https://second.example.com',
      'alice',
      first.publicKey,
    ),
    /different device identity/,
  );
  assert.deepEqual(await store.loadIdentity('https://second.example.com', 'alice'), second);
  assert.equal(await store.loadIdentity('https://third.example.com', 'alice'), null);
});
test('unlinked servers and different accounts retain independent identities', async () => {
  const store = createIdentityStore(vault());
  const alice = await store.registrationIdentity('https://first.example.com', 'alice');
  const bob = await store.registrationIdentity('https://first.example.com', 'bob');
  assert.notEqual(alice.publicKey, bob.publicKey);
  assert.equal(await store.loadIdentity('https://second.example.com', 'alice'), null);
  assert.deepEqual(await store.registrationIdentity('https://first.example.com', 'ALICE'), alice);
});
