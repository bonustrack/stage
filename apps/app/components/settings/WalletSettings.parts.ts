
import { useEffect, useState } from 'react';
import { KERNEL_VERSION_STRING, ENTRY_POINT_VERSION, SCW_CHAIN_ID } from '@stage-labs/client/zerodev/config';
import { getActiveAccount, type AccountRecord } from '../../lib/accounts';
import { makePublicClient } from '../../lib/zerodev/client';

export type ModuleRole = 'sudo' | 'backup' | 'recovery' | 'session';
interface WalletModule {
  name: string;
  role: ModuleRole;
  status: string;
}

export type DeployState = 'loading' | 'deployed' | 'counterfactual' | 'unknown';

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

export function useWalletModel(epoch: number): { model: WalletModel | null; deploy: DeployState } {
  const [model, setModel] = useState<WalletModel | null>(null);
  const [deploy, setDeploy] = useState<DeployState>('loading');

  useEffect(() => {
    let alive = true;
    setDeploy('loading');
    void (async (): Promise<void> => {
      const rec = await getActiveAccount();
      if (!alive) return;
      if (!rec) { setModel(null); setDeploy('unknown'); return; }
      setModel(modelFromRecord(rec));
      if (rec.type !== 'smart') { setDeploy('unknown'); return; }
      try {
        const client = makePublicClient();
        const code = await client.getCode({ address: rec.address as `0x${string}` });
        if (!alive) return;
        setDeploy(code && code !== '0x' ? 'deployed' : 'counterfactual');
      } catch {
        if (alive) setDeploy('unknown');
      }
    })();
    return () => { alive = false; };
  }, [epoch]);

  return { model, deploy };
}
