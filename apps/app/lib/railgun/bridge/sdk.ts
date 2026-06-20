import { rawCall } from './transport';

const SDK_TIMEOUT_MS = 90_000;

export async function sdk<T = unknown>(method: string, args: readonly unknown[] = []): Promise<T> {
  return (await rawCall('sdk', { method, args }, SDK_TIMEOUT_MS)) as T;
}

export async function sdkListMethods(): Promise<string[]> {
  return (await rawCall('sdk', { method: 'listMethods', args: [] }, SDK_TIMEOUT_MS)) as string[];
}
