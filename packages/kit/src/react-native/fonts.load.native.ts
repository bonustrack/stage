import { loadAsync } from 'expo-font';
import { KIT_FONTS } from './fonts';

loadAsync(KIT_FONTS).catch((error: unknown) => {
  console.warn('Kit could not load its fonts', error);
});
