/** Data layer for Settings -> Wallet. Pure read-only assembly of a display model
 *  for the ACTIVE account: account metadata (label / HD index / addresses),
 *  active signer (passkey vs recovery key), the Kernel modules / validators, the
 *  on-chain deploy status, and the XMTP identity address. NO private key or
 *  mnemonic is ever read or returned here - addresses + module metadata only, so
 *  the keyring chokepoint stays intact.
 *
 *  Deploy status is detected by reading the contract code at the smart-account
 *  address on Base via the public client (publicClient.getCode): empty / 0x ->
 *  counterfactual (not yet deployed), any bytecode -> deployed on-chain. */

import { useEffect, useState } from 'react';
import { KERNEL_VERSION_STRING, ENTRY_POINT_VERSION, SCW_CHAIN_ID } from '@stage-labs/client/zerodev/config';
import { getActiveAccount, type AccountRecord } from '../../lib/accounts';
import { makePublicClient } from '../../lib/zerodev/client';

export type ModuleRole = 'sudo' | 'backup' | 'recovery' | 'session';
export interface WalletModule {
  /** Human name of the validator / module. */
  name: string;
  /** Its role on the Kernel. */
  role: ModuleRole;
  /** Short status / detail line (e.g. "Active signer", "2 of 3, 48h delay"). */
  status: string;
}

export type DeployState = 'loading' | 'deployed' | 'counterfactual' | 'unknown';

export interface WalletModel {
  rec: AccountRecord;
  isSmart: boolean;
  /** Counterfactual Kernel / account address (== rec.address). */
  address: string;
  label: string;
  hdIndex: number | null;
  /** 'Passkey' when rec.passkey is present, else 'Recovery key'. */
  activeSigner: 'Passkey' | 'Recovery key';
  /** Derived ECDSA owner / recovery EOA address (display only). */
  ownerAddress: string | null;
  /** The address used as the XMTP identity (SCW address when scwXmtp on). */
  xmtpAddress: string;
  modules: WalletModule[];
  chainId: number;
  kernelVersion: string;
  entryPointVersion: string;
  guardianCount: number;
}

/** Format a recovery-timelock delay (seconds) into a compact human string. */
function formatDelay(seconds?: number): string | null {
  if (!seconds || seconds <= 0) return null;
  if (seconds % 86400 === 0) return `${seconds / 86400}d`;
  if (seconds % 3600 === 0) return `${seconds / 3600}h`;
  if (seconds % 60 === 0) return `${seconds / 60}m`;
  return `${seconds}s`;
}

/** Build the ordered module / validator list from a smart-account record. The
 *  on-chain source of truth lives in the Kernel; this mirrors what the app
 *  configured (passkey validator + ECDSA owner + optional guardian validator). */
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

/** Assemble the synchronous part of the wallet model from a record. */
function modelFromRecord(rec: AccountRecord): WalletModel {
  const isSmart = rec.type === 'smart';
  /** XMTP identity is the SCW (Kernel) address unless the legacy escape hatch
   *  (scwXmtp === false) is set explicitly - mirrors lib/xmtp.codecs. */
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

/** Read-only hook: the active account's wallet model + live deploy status.
 *  `epoch` re-fetches when the active account changes. Deploy status starts as
 *  'loading' and resolves to 'deployed' / 'counterfactual' / 'unknown'. */
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
