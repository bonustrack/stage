import { isRowCleared, isSyncGroupName, type ClearedChats } from '@stage-labs/client/xmtp/readState';
import type { CachedChannelRow } from '@stage-labs/client/xmtp/channelsCache';
import { attachmentKindOf } from '@stage-labs/client/xmtp/humanize';
import type { IncomingShare, SharedFile } from '../../lib/incomingShare.types';
import { attachmentMimeType } from '../../lib/attachmentFiles';
import type { Attachment } from '../composer/types';

const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_TOTAL_BYTES = 50 * 1024 * 1024;
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' ? value as Record<string, unknown> : null;
}

function validName(name: unknown): name is string {
  return typeof name === 'string' && name.length > 0 && name.length <= 160 && !/[\x00-\x1f\x7f/\\]/.test(name);
}

function validMime(mime: unknown): mime is string {
  return typeof mime === 'string' && mime.length <= 127 && /^[\w!#$&^_.+-]+\/[\w!#$&^_.+-]+$/.test(mime);
}

function validSize(size: unknown): size is number {
  return typeof size === 'number' && Number.isSafeInteger(size) && size > 0 && size <= MAX_FILE_BYTES;
}

function validFileUri(uri: unknown, id: string): uri is string {
  if (typeof uri !== 'string') return false;
  return uri.startsWith('file:///') && !/[?#%\\]/.test(uri) && !uri.split('/').includes('..')
    && uri.slice(0, -1).endsWith(`/stage-shares/${id}/`) && /^[0-9]$/.test(uri.slice(-1));
}

function sharedFile(value: unknown, id: string): SharedFile | null {
  const file = record(value);
  if (file === null) return null;
  const { uri, name, mimeType, size } = file;
  if (!validFileUri(uri, id) || !validName(name) || !validMime(mimeType) || !validSize(size)) return null;
  return { uri, name, mimeType, size };
}

function readyShare(id: string, value: unknown): IncomingShare {
  const failed: IncomingShare = { id, status: 'error', error: 'unsupported' };
  if (!Array.isArray(value) || value.length === 0 || value.length > 10) return failed;
  const files = value.map(file => sharedFile(file, id));
  if (files.some(file => file === null)) return failed;
  const valid = files.filter((file): file is SharedFile => file !== null);
  if (new Set(valid.map(file => file.uri)).size !== valid.length || valid.reduce((sum, file) => sum + file.size, 0) > MAX_TOTAL_BYTES) return { id, status: 'error', error: 'size' };
  return { id, status: 'ready', files: valid };
}

export function parseIncomingShare(value: unknown): IncomingShare | null {
  const share = record(value);
  if (share === null || typeof share.id !== 'string' || !ID.test(share.id)) return null;
  const { id, status } = share;
  if (status === 'loading') return { id, status };
  if (status === 'error') return { id, status, error: typeof share.error === 'string' ? share.error : 'read' };
  return status === 'ready' ? readyShare(id, share.files) : { id, status: 'error', error: 'unsupported' };
}

export function sharedAttachments(share: Extract<IncomingShare, { status: 'ready' }>): Attachment[] {
  return share.files.map((file, index) => {
    const mime = attachmentMimeType(file.mimeType, file.name);
    return { id: `${share.id}:${index}`, url: file.uri, name: file.name, mime, kind: attachmentKindOf({ mimeType: mime }), size: file.size };
  });
}

export interface ShareDestination {
  convId: string;
  title: string;
  peerAddress: string | null;
  avatarUri: string | null;
  lastBubbleTs: number | null;
}

function destinationOf(row: CachedChannelRow, cleared: ClearedChats): ShareDestination | null {
  if (row.consent !== 'allowed' || typeof row.title !== 'string') return null;
  if (typeof row.groupName === 'string' && isSyncGroupName(row.groupName)) return null;
  const peerAddress = typeof row.peerAddress === 'string' ? row.peerAddress : null;
  const lastTs = typeof row.lastTs === 'number' ? row.lastTs : null;
  const lastBubbleTs = typeof row.lastBubbleTs === 'number' ? row.lastBubbleTs : null;
  if (isRowCleared(cleared, { peerAddress, lastTs, lastBubbleTs })) return null;
  return { convId: row.convId, title: row.title, peerAddress, avatarUri: typeof row.avatarUri === 'string' ? row.avatarUri : null, lastBubbleTs };
}

export function acceptedShareConsent(group: boolean, hidden: boolean | undefined, consent: string | null): boolean {
  if (hidden === true) return false;
  return group && hidden !== undefined ? true : consent === 'allowed';
}

export function mergeShareRows<T extends { convId: string }>(previous: readonly T[] | null, updates: readonly T[] | null): T[] {
  const rows = new Map((previous ?? []).map(row => [row.convId, row]));
  for (const row of updates ?? []) rows.set(row.convId, row);
  return [...rows.values()];
}

export function shareDestinations(rows: readonly CachedChannelRow[] | null, cleared: ClearedChats, query: string): ShareDestination[] {
  return (rows ?? []).map(row => destinationOf(row, cleared))
    .filter((row): row is ShareDestination => row !== null && row.title.toLowerCase().includes(query.trim().toLowerCase()));
}

export function shareError(error: string): string {
  if (error === 'count') return 'Share up to 10 files at a time.';
  if (error === 'size') return 'Shared files must be at most 25 MiB each and 50 MiB in total.';
  if (error === 'storage') return 'The share cache is full. Restart Stage, then share fewer files.';
  if (error === 'empty') return 'This file is empty. Choose another file.';
  if (error === 'interrupted') return 'This share was interrupted. Share the files again from the original app.';
  if (error === 'unsupported') return 'Share images, videos or files with Stage. Text-only shares are not supported.';
  return 'Stage could not read these files. Cancel, then share them again from the original app.';
}
