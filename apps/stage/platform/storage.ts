import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppStorage, SecureAccessOptions, SecureStorage } from './types';

function toStoreOptions(options?: SecureAccessOptions): SecureStore.SecureStoreOptions {
  const opts: SecureStore.SecureStoreOptions = {};
  if (options?.thisDeviceOnly) opts.keychainAccessible = SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY;
  if (options?.requireAuthentication) opts.requireAuthentication = true;
  if (options?.authenticationPrompt !== undefined) opts.authenticationPrompt = options.authenticationPrompt;
  return opts;
}

export const secureStorage: SecureStorage = {
  get: (key, options) => SecureStore.getItemAsync(key, toStoreOptions(options)),
  set: (key, value, options) => SecureStore.setItemAsync(key, value, toStoreOptions(options)),
  delete: (key) => SecureStore.deleteItemAsync(key),
};

export const appStorage: AppStorage = {
  get: (key) => AsyncStorage.getItem(key),
  set: (key, value) => AsyncStorage.setItem(key, value),
  delete: (key) => AsyncStorage.removeItem(key),
  multiGet: (keys) => AsyncStorage.multiGet(keys),
  clear: () => AsyncStorage.clear(),
};
