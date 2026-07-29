
import { useQuery } from '@tanstack/react-query';
import { KERNEL_VERSION_STRING, ENTRY_POINT_VERSION, SCW_CHAIN_ID } from '@stage-labs/client/zerodev/config';
import type { WalletDeployState, WalletModuleRole } from './WalletSettings.model';
import type { AccountRecord } from '../../lib/accounts';
import { useActiveAccountRecord } from '../../modules/messaging';
import { makePublicClient } from '../../lib/zerodev/client';

export type ModuleRole = WalletModuleRole;
interface WalletModule {
  name: string;
  role: ModuleRole;
  status: string;
}

export type DeployState = WalletDeployState;

export interface WalletModel {
  rec: AccountRecord;
  isSmart: boolean;
  address: string;
  label: string;
  hdIndex: number | null;
  activeSigner: 'Passkey' | 'Recovery key';
  ownerAddress: string | null;
  xmtpAddress: string;
  modules: WalletModule[];
  chainId: number;
  kernelVersion: string;
  entryPointVersion: string;
  guardianCount: number;
}

function formatDelay(seconds?: number): string | null {
  if (!seconds || seconds <= 0) return null;
  if (seconds % 86400 === 0) return `${seconds / 86400}d`;
  if (seconds % 3600 === 0) return `${seconds / 3600}h`;
  if (seconds % 60 === 0) return `${seconds / 60}m`;
  return `${seconds}s`;
}

function buildModules(rec: AccountRecord): WalletModule[] {
  const mods: WalletModule[] = [];
  const hasPasskey = !!rec.passkey;

  if (hasPasskey) {
    mods.push({ name: 'Passkey validator', role: 'sudo', status: 'Active signer (WebAuthn)' });
    mods.push({ name: 'ECDSA owner key', role: 'backup', status: 'Mnemonic-derived, fallback' });
  } else {
    mods.push({ name: 'ECDSA owner key', role: 'sudo', status: 'Active signer (mnemonic-derived)' });
  }

  const guardians = rec.guardians ?? [];
  if (guardians.length) {
    const threshold = rec.guardianThreshold ?? guardians.length;
    const delay = formatDelay(rec.guardianDelay);
    const detail = `${threshold} of ${guardians.length}${delay ? `, ${delay} delay` : ''}`;
    mods.push({ name: 'Guardian recovery', role: 'recovery', status: detail });
  }

  return mods;
}

function modelFromRecord(rec: AccountRecord): WalletModel {
  const isSmart = rec.type === 'smart';
  const xmtpAddress = rec.scwXmtp === false ? (rec.ownerAddress ?? rec.address) : rec.address;
  return {
    rec,
    isSmart,
    address: rec.address,
    label: rec.label ?? 'Account',
    hdIndex: rec.hdIndex ?? null,
    activeSigner: rec.passkey ? 'Passkey' : 'Recovery key',
    ownerAddress: rec.ownerAddress ?? null,
    xmtpAddress,
    modules: isSmart ? buildModules(rec) : [],
    chainId: SCW_CHAIN_ID,
    kernelVersion: KERNEL_VERSION_STRING,
    entryPointVersion: ENTRY_POINT_VERSION,
    guardianCount: (rec.guardians ?? []).length,
  };
}

async function fetchDeployState(rec: AccountRecord): Promise<DeployState> {
  if (rec.type !== 'smart') return 'unknown';
  try {
    const code = await makePublicClient().getCode({ address: rec.address as `0x${string}` });
    return code && code !== '0x' ? 'deployed' : 'counterfactual';
  } catch {
    return 'unknown';
  }
}

export function useWalletModel(): { model: WalletModel | null; deploy: DeployState } {
  const rec = useActiveAccountRecord();
  const { data: deploy } = useQuery({
    queryKey: ['walletDeployState', rec?.id ?? '', rec?.address ?? ''],
    queryFn: () => (rec ? fetchDeployState(rec) : Promise.resolve<DeployState>('unknown')),
    enabled: !!rec,
    staleTime: 60_000,
  });
  return { model: rec ? modelFromRecord(rec) : null, deploy: deploy ?? 'loading' };
}
