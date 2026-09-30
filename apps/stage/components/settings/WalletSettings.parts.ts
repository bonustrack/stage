
import { useQuery } from '@tanstack/react-query';
import { KERNEL_VERSION_STRING, ENTRY_POINT_VERSION, SCW_CHAIN_ID } from '@stage-labs/client/zerodev/config';
import type { WalletDeployState, WalletModuleRole } from './WalletSettings.model';
import type { AccountRecord } from '../../lib/accounts';
import { useActiveAccountRecord } from '../../modules/messaging';
import { makePublicClient } from '../../lib/zerodev/client';

interface WalletModule {
  name: string;
  role: WalletModuleRole;
  status: string;
}

export interface WalletModel {
  rec: AccountRecord;
  isSmart: boolean;
  address: string;
  label: string;
  hdIndex: number | null;
  activeSigner: 'Recovery key';
  ownerAddress: string | null;
  xmtpAddress: string;
  modules: WalletModule[];
  chainId: number;
  kernelVersion: string;
  entryPointVersion: string;
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
    activeSigner: 'Recovery key',
    ownerAddress: rec.ownerAddress ?? null,
    xmtpAddress,
    modules: isSmart ? [{ name: 'ECDSA owner key', role: 'sudo', status: 'Main key (recovery phrase)' }] : [],
    chainId: SCW_CHAIN_ID,
    kernelVersion: KERNEL_VERSION_STRING,
    entryPointVersion: ENTRY_POINT_VERSION,
  };
}

async function fetchDeployState(rec: AccountRecord): Promise<WalletDeployState> {
  if (rec.type !== 'smart') return 'unknown';
  try {
    const code = await makePublicClient().getCode({ address: rec.address as `0x${string}` });
    return code && code !== '0x' ? 'deployed' : 'counterfactual';
  } catch {
    return 'unknown';
  }
}

export function useWalletModel(): { model: WalletModel | null; deploy: WalletDeployState } {
  const rec = useActiveAccountRecord();
  const { data: deploy } = useQuery({
    queryKey: ['walletDeployState', rec?.id ?? '', rec?.address ?? ''],
    queryFn: () => (rec ? fetchDeployState(rec) : Promise.resolve<WalletDeployState>('unknown')),
    enabled: !!rec,
    staleTime: 60_000,
  });
  return { model: rec ? modelFromRecord(rec) : null, deploy: deploy ?? 'loading' };
}
