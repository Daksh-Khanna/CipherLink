import { generateIdentity } from '@cipherlink/shared';
import { decodeUTF8 } from 'tweetnacl-util';
export type DeviceIdentity = ReturnType<typeof generateIdentity>;
type Vault = { getItem: (key: string) => Promise<string | null>; setItem: (key: string, value: string) => Promise<void> };
const scope = (server: string, username: string) => Array.from(decodeUTF8(`${server}|${username.toLowerCase()}`), b => b.toString(16).padStart(2, '0')).join('');

export function createIdentityStore(vault: Vault) {
  const identityScope = async (server: string, username: string) => await vault.getItem(`server-alias.${scope(server, username)}`) || server;
  const loadIdentity = async (server: string, username: string): Promise<DeviceIdentity | null> => {
    const realm = await identityScope(server, username);
    const raw = await vault.getItem(`identity.${scope(realm, username)}`);
    return raw ? JSON.parse(raw) : null;
  };
  const registrationIdentity = async (server: string, username: string) => {
    const existing = await loadIdentity(server, username);
    if (existing) return existing;
    const identity = generateIdentity();
    const realm = await identityScope(server, username);
    // Persist before sending registration, including if its response is lost.
    await vault.setItem(`identity.${scope(realm, username)}`, JSON.stringify(identity));
    return identity;
  };
  const trustContact = async (server: string, username: string, peerId: string, publicKey: string) => {
    const realm = await identityScope(server, username);
    const key = `trust.${scope(realm, username)}.${peerId}`;
    const pinned = await vault.getItem(key);
    if (pinned && pinned !== publicKey) throw new Error('Contact identity changed. Communication is blocked. Verify the fingerprint with your contact through a trusted channel.');
    if (!pinned) await vault.setItem(key, publicKey);
  };
  // Caller first verifies the account at the new address. Alias its local realm
  // so both private identity and existing contact pins keep their original keys.
  const linkServerAddress = async (previous: string, next: string, username: string, publicKey: string) => {
    const identity = await loadIdentity(previous, username);
    if (!identity || identity.publicKey !== publicKey) throw new Error('The original device identity could not be verified.');
    const existing = await loadIdentity(next, username);
    if (existing && existing.publicKey !== publicKey) throw new Error('This address already has a different device identity for that username.');
    const realm = await identityScope(previous, username);
    await vault.setItem(`server-alias.${scope(next, username)}`, realm);
  };
  return { loadIdentity, registrationIdentity, trustContact, linkServerAddress };
}
