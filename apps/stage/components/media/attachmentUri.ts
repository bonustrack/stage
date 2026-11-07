import { Platform } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { backoffDelay } from '@stage-labs/client/timing';
import { resolveRemoteAttachment } from '../../lib/xmtp.attachmentSdk';
import { useLocalAttachment } from '../../lib/localAttachmentCache';
import type { EntryAttachment as Attachment } from '@stage-labs/client/xmtp/entryPayload';
import { attachmentSource, type AttachmentSource } from './attachment';

const WEB_PLAYABLE_MIME: Readonly<Record<string, string>> = { 'audio/m4a': 'audio/mp4' };

function dataUrlMime(mime: string | undefined): string {
  const declared = mime ?? 'application/octet-stream';
  return Platform.OS === 'web' ? (WEB_PLAYABLE_MIME[declared] ?? declared) : declared;
}

export function inlineAttachmentUrl(att: Attachment): string {
  return att.dataB64 ? `data:${dataUrlMime(att.mime)};base64,${att.dataB64}` : (att.url ?? '');
}

const REMOTE_RETRIES = 6;

const REMOTE_BACKOFF = { baseMs: 2_000, maxMs: 30_000 };

function remoteRetryDelay(failures: number): number {
  return backoffDelay(failures + 1, REMOTE_BACKOFF);
}

function fetchRemote(remote: Attachment['remote']): Promise<{ fileUri: string; mimeType?: string }> {
  if (!remote) throw new Error('attachment has no remote');
  return resolveRemoteAttachment(remote);
}

export function useRemoteAttachment(remote: Attachment['remote']): {
  uri: string | null;
  mime: string | undefined;
  isError: boolean;
  retry: () => void;
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
    retry: () => {
      void refetch();
    },
  };
}

export function useAttachmentUri(
  att: Attachment | undefined,
  msgId: string | undefined,
  index: number | undefined,
): AttachmentSource & { retry: () => void } {
  const local = useLocalAttachment(msgId, index, att?.remote);
  const remote = useRemoteAttachment(att?.remote);
  const source =
    att === undefined ? { uri: null, mime: undefined, failed: false } : attachmentSource(att, inlineAttachmentUrl(att), local, remote);
  return { ...source, retry: remote.retry };
}
