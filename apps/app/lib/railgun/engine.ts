import { isRailgunAvailable } from './native';
import { initEngine, ensureProvider, isEngineReady } from './sdkEngine';
import { DEFAULT_RAILGUN_NET, netForChainId } from './networks';

export async function prewarmRailgun(): Promise<boolean> {
  if (isEngineReady()) return true;
  if (!isRailgunAvailable()) return false;
  const ok = await initEngine();
  if (!ok) return false;
  await ensureProvider(DEFAULT_RAILGUN_NET).catch(() => undefined);
  return true;
}

export async function ensureRailgunForChain(chainId: number): Promise<boolean> {
  if (!isRailgunAvailable()) return false;
  const ok = isEngineReady() ? true : await initEngine();
  if (!ok) return false;
  await ensureProvider(netForChainId(chainId).net).catch(() => undefined);
  return true;
}
