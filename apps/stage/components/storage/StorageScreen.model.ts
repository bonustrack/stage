import { fileKey, type StoredFile } from '../../lib/storageIndex.model';
import { fileSizeLabel } from '../bubble/fileCard.model';

export type StorageKind = 'image' | 'document' | 'audio' | 'video' | 'other';

export type StorageFilter = StorageKind | 'all';

export const STORAGE_FILTERS: readonly { value: StorageFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'image', label: 'Images' },
  { value: 'document', label: 'Documents' },
  { value: 'audio', label: 'Audio' },
  { value: 'video', label: 'Video' },
  { value: 'other', label: 'Other' },
];

const KIND_EXTENSIONS: readonly (readonly [StorageKind, readonly string[]])[] = [
  ['image', ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'avif', 'bmp', 'tif', 'tiff', 'svg', 'ico']],
  ['video', ['mp4', 'mov', 'm4v', 'webm', 'mkv', 'avi', 'wmv', '3gp', 'mpg', 'mpeg']],
  ['audio', ['m4a', 'mp3', 'wav', 'aac', 'ogg', 'oga', 'opus', 'flac', 'weba', 'amr', 'caf', 'aif', 'aiff', 'mid', 'midi']],
  ['document', [
    'pdf', 'doc', 'docx', 'txt', 'md', 'rtf', 'odt', 'ods', 'odp', 'xls', 'xlsx', 'csv', 'tsv', 'ppt', 'pptx',
    'key', 'pages', 'numbers', 'json', 'xml', 'html', 'htm', 'epub',
  ]],
];

export interface StorageRow {
  key: string;
  file: StoredFile;
  kind: StorageKind;
  detail: string;
}

export interface StorageView {
  query: string;
  filter: StorageFilter;
  hidden: ReadonlySet<string>;
}

export function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot > 0 && dot < name.length - 1 ? name.slice(dot + 1).toLowerCase() : '';
}

export function storageKindOf(name: string): StorageKind {
  const ext = extensionOf(name.trim());
  return KIND_EXTENSIONS.find(([, exts]) => exts.includes(ext))?.[0] ?? 'other';
}

export function storageDateLabel(ms: number, now: number): string {
  const d = new Date(ms);
  const today = new Date(now);
  if (d.toDateString() === today.toDateString()) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const sameYear = d.getFullYear() === today.getFullYear();
  return d.toLocaleDateString([], sameYear ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' });
}

function matches(file: StoredFile, kind: StorageKind, view: StorageView, query: string): boolean {
  if (view.hidden.has(file.messageId)) return false;
  if (view.filter !== 'all' && view.filter !== kind) return false;
  return query === '' || file.name.toLowerCase().includes(query);
}

export function storageRows(files: readonly StoredFile[], view: StorageView, now: number): StorageRow[] {
  const query = view.query.trim().toLowerCase();
  const rows: StorageRow[] = [];
  for (const file of files) {
    const kind = storageKindOf(file.name);
    if (!matches(file, kind, view, query)) continue;
    const detail = [fileSizeLabel(file.size), storageDateLabel(file.sentMs, now)].filter(Boolean).join(' · ');
    rows.push({ key: fileKey(file), file, kind, detail });
  }
  return rows;
}

export function storageSummary(files: readonly StoredFile[], hidden: ReadonlySet<string>): string {
  const shown = files.filter(f => !hidden.has(f.messageId));
  if (shown.length === 0) return '';
  const bytes = shown.reduce((sum, f) => sum + f.size, 0);
  const count = `${shown.length} ${shown.length === 1 ? 'file' : 'files'}`;
  return bytes > 0 ? `${count} · ${fileSizeLabel(bytes)}` : count;
}

export function scanProgressLabel(done: number, total: number): string {
  return total > 0 ? `Finding your files… ${Math.min(done, total)} of ${total} chats` : 'Finding your files…';
}

export interface StorageStatus {
  files: readonly StoredFile[];
  scanning: boolean;
  firstScan: boolean;
  failed: boolean;
  done: number;
  total: number;
}

export function storageStatusLabel(status: StorageStatus, hidden: ReadonlySet<string>): string {
  if (status.firstScan) return scanProgressLabel(status.done, status.total);
  const summary = storageSummary(status.files, hidden);
  if (!status.failed || status.scanning) return summary;
  return [summary, 'Some chats could not be read'].filter(Boolean).join(' · ');
}

export function chatLabelOf(
  chat: { peerAddress: string | null; groupName: string } | null | undefined,
  peerName: string | undefined,
  shortAddress: (address: string) => string,
): string {
  if (chat === null || chat === undefined) return '';
  if (chat.peerAddress !== null) return peerName ?? shortAddress(chat.peerAddress);
  const name = chat.groupName.trim();
  return name === '' ? 'Unnamed channel' : name;
}
