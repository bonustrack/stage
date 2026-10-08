import { Platform } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { resolveRemoteAttachment } from '../../lib/xmtp.attachments';
import type { Attachment } from './helpers';

const WEB_PLAYABLE_MIME: Readonly<Record<string, string>> = { 'audio/m4a': 'audio/mp4' };

function dataUrlMime(mime: string | undefined): string {
  const declared = mime ?? 'application/octet-stream';
  return Platform.OS === 'web' ? WEB_PLAYABLE_MIME[declared] ?? declared : declared;
}

export function inlineAttachmentUrl(att: Attachment): string {
  return att.dataB64
    ? `data:${dataUrlMime(att.mime)};base64,${att.dataB64}`
    : att.url ?? '';
}

const REMOTE_RETRIES = 6;

function remoteRetryDelay(failures: number): number {
  return Math.min(2_000 * 2 ** failures, 30_000);
}

function fetchRemote(remote: Attachment['remote']): Promise<{ fileUri: string; mimeType?: string }> {
  if (!remote) throw new Error('attachment has no remote');
  return resolveRemoteAttachment(remote);
}

export function useRemoteAttachment(remote: Attachment['remote']): {
  uri: string | null; mime: string | undefined; isError: boolean; retry: () => void;
} {
  const { data, isError, refetch } = useQuery({
    queryKey: ['remoteAttachment', remote?.url ?? ''],
    queryFn: () => fetchRemote(remote),
    enabled: !!remote,
    staleTime: Infinity,
    retry: REMOTE_RETRIES,
    retryDelay: remoteRetryDelay,
  });
  return {
    uri: data?.fileUri ?? null,
    mime: data?.mimeType,
    isError,
    retry: () => { void refetch(); },
  };
}
