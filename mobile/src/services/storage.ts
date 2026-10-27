import * as SecureStore from 'expo-secure-store';
import { createIdentityStore } from './identity-store';
export type { DeviceIdentity } from './identity-store';
const options = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
export const saveSecure = (key: string, value: string) =>
  SecureStore.setItemAsync(key, value, options);
export const getSecure = (key: string) => SecureStore.getItemAsync(key, options);
export const deleteSecure = (key: string) => SecureStore.deleteItemAsync(key);
export const { loadIdentity, registrationIdentity, trustContact, linkServerAddress } =
  createIdentityStore({ getItem: getSecure, setItem: saveSecure });
