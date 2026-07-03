const RAW_ENV: Record<string, string | undefined> = {
  EXPO_PUBLIC_ZERODEV_PROJECT_ID: process.env.EXPO_PUBLIC_ZERODEV_PROJECT_ID,
  EXPO_PUBLIC_ZERODEV_RPC: process.env.EXPO_PUBLIC_ZERODEV_RPC,
};

function envString(name: string): string | undefined {
  const value = RAW_ENV[name];
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

const PROJECT_ID: string = envString('EXPO_PUBLIC_ZERODEV_PROJECT_ID') ?? '';

export function zerodevRpcUrl(): string | null {
  const override = envString('EXPO_PUBLIC_ZERODEV_RPC');
  if (override) return override;
  if (!PROJECT_ID) return null;
  return `https://rpc.zerodev.app/api/v3/${PROJECT_ID}/chain/8453`;
}

export function zerodevConfigured(): boolean {
  return zerodevRpcUrl() != null;
}
