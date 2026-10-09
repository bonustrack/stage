const SUMMARY_RE = /^\[(?:(?:image|audio|video|file): .+|\d+ attachments)\]$/;

export function isAttachmentSummary(text: string | undefined, attachmentCount: number): boolean {
  return attachmentCount > 0 && text !== undefined && SUMMARY_RE.test(text.trim());
}

const UNITS = ['B', 'KB', 'MB', 'GB'] as const;

export function fileSizeLabel(bytes: number | undefined): string {
  if (bytes === undefined || !Number.isFinite(bytes) || bytes < 0) return '';
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) { value /= 1024; unit += 1; }
  const rounded = unit === 0 || value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${rounded} ${UNITS[unit] ?? 'B'}`;
}

function fileTypeLabel(name: string | undefined, mime: string | undefined): string {
  const ext = name?.includes('.') ? name.split('.').pop() ?? '' : '';
  if (ext) return ext.toUpperCase();
  const sub = mime?.split('/')[1]?.split(/[+;]/)[0] ?? '';
  return sub ? sub.toUpperCase() : 'File';
}

export interface FileCardModel { title: string; subtitle: string }

export function fileCardModel(a: { name?: string; mime?: string; size?: number; kind: string }): FileCardModel {
  const name = a.name?.trim() ?? '';
  const title = name === '' ? `${a.kind} attachment` : name;
  const subtitle = [fileTypeLabel(a.name, a.mime), fileSizeLabel(a.size)].filter(Boolean).join(' · ');
  return { title, subtitle };
}

export function attachmentPreview(
  att: { mime?: string },
  local: { uri: string; mime?: string } | undefined,
  remote: { uri: string | null; mime?: string },
): { uri: string | null; mime: string | undefined } {
  return { uri: local?.uri ?? remote.uri, mime: remote.mime ?? local?.mime ?? att.mime };
}

export function isSvgAttachment(att: { mime?: string; name?: string }): boolean {
  return /^image\/svg/i.test(att.mime?.trim() ?? '') || /\.svgz?$/i.test(att.name?.trim() ?? '');
}

export function resolvedAttachmentKind(att: { kind: string; mime?: string; name?: string }): string {
  if (isSvgAttachment(att)) return 'file';
  if (att.mime?.startsWith('image/')) return 'image';
  if (att.mime?.startsWith('audio/')) return 'audio';
  if (att.mime?.startsWith('video/')) return 'video';
  return att.kind;
}
