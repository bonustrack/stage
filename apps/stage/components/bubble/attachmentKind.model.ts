export function resolvedAttachmentKind(att: { kind: string; mime?: string }): string {
  if (att.mime?.startsWith('image/')) return 'image';
  if (att.mime?.startsWith('audio/')) return 'audio';
  if (att.mime?.startsWith('video/')) return 'video';
  return att.kind;
}
