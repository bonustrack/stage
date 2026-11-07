import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import {
  deleteAccount,
  listXmtpInstallations,
  resetActiveXmtpStore,
  revokeXmtpInstallation,
  selfEthAddress,
  switchToAccount,
  xmtpClient,
} from './xmtp.client';
import { sdk } from './xmtp.sdk';
import type { XmtpInstallation } from './xmtp.client.core';
import { getActiveAccount } from './accounts';
import { capabilities } from './capabilities';
import { accountQueryKey, accountQueryKeyAt, getQueryClient, useAccountGeneration } from './queryClient';

const INSTALLATIONS_KEY = 'xmtpInstallations';

const IDENTITY_KEY = 'xmtpIdentity';

export function useInstallations(refetchOnMount: boolean | 'always' = true): UseQueryResult<XmtpInstallation[]> {
  const epoch = useAccountGeneration('client');
  return useQuery({
    queryKey: accountQueryKeyAt('client', epoch, INSTALLATIONS_KEY),
    queryFn: listXmtpInstallations,
    staleTime: 60_000,
    retry: false,
    refetchOnMount,
  });
}

export async function revokeInstallation(installationId: string): Promise<void> {
  await revokeXmtpInstallation(installationId);
  await getQueryClient().invalidateQueries({ queryKey: accountQueryKey('client', INSTALLATIONS_KEY) });
}

interface XmtpIdentity {
  addr: string;
  inbox: string;
  install: string;
}

const NO_IDENTITY: XmtpIdentity = { addr: '', inbox: '', install: '' };

async function fetchXmtpIdentity(): Promise<XmtpIdentity> {
  const client = await xmtpClient();
  const address = await selfEthAddress();
  return { addr: address ?? '', inbox: sdk.inboxIdOf(client), install: sdk.installationIdOf(client) ?? '' };
}

export function useXmtpIdentity(): XmtpIdentity {
  const epoch = useAccountGeneration('client');
  return (
    useQuery({ queryKey: accountQueryKeyAt('client', epoch, IDENTITY_KEY), queryFn: fetchXmtpIdentity, staleTime: Infinity }).data ??
    NO_IDENTITY
  );
}

export async function resetXmtpDatabase(copy: { title: string; message: string }): Promise<void> {
  if (!(await capabilities.confirm({ ...copy, confirmLabel: 'Reset', destructive: true }))) return;
  await resetActiveXmtpStore();
  capabilities.reload();
}

export async function removeAccountFromDevice(id: string): Promise<void> {
  await deleteAccount(id);
  const next = (await getActiveAccount())?.id;
  if (next === undefined) {
    capabilities.reload(true);
    return;
  }
  await switchToAccount(next);
  capabilities.navigate('/');
}
