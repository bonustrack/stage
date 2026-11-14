import { envString } from './env';

function featureOn(value: unknown): boolean {
  return envString(value) !== 'off';
}

export const WALLET_ENABLED = featureOn(process.env.EXPO_PUBLIC_WALLET);

export const CALLS_ENABLED = featureOn(process.env.EXPO_PUBLIC_CALLS);

export const DEVELOPER_MODE_AVAILABLE = featureOn(process.env.EXPO_PUBLIC_DEVELOPER_MODE);
