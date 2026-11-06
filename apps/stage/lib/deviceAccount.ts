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
import type { XmtpInstallation } from './xmtp.client.core';
import { getActiveAccount } from './accounts';
import { useAccountEpoch } from './accountEpoch';
import { capabilities } from './capabilities';
import { getQueryClient } from './queryClient';

const INSTALLATIONS_KEY = 'xmtpInstallations';

const IDENTITY_KEY = 'xmtpIdentity';

export function useInstallations(refetchOnMount: boolean | 'always' = true): UseQueryResult<XmtpInstallation[]> {
  const epoch = useAccountEpoch();
  return useQuery({
    queryKey: [INSTALLATIONS_KEY, epoch],
    queryFn: listXmtpInstallations,
    staleTime: 60_000,
    retry: false,
    refetchOnMount,
  });
}

export async function revokeInstallation(installationId: string): Promise<void> {
  await revokeXmtpInstallation(installationId);
  await getQueryClient().invalidateQueries({ queryKey: [INSTALLATIONS_KEY] });
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
  return { addr: address ?? '', inbox: client.inboxId, install: client.installationId ?? '' };
}

export function useXmtpIdentity(): XmtpIdentity {
  const epoch = useAccountEpoch();
  return useQuery({ queryKey: [IDENTITY_KEY, epoch], queryFn: fetchXmtpIdentity, staleTime: Infinity }).data ?? NO_IDENTITY;
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
