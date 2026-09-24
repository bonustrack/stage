export interface PastedFile {
  kind: string;
  type: string;
}

export function takesImagePaste(targetTag: string | null, editable: boolean): boolean {
  if (!editable) return true;
  return targetTag === 'TEXTAREA';
}

export function imageItemIndexes(items: readonly PastedFile[]): number[] {
  return items.flatMap((item, i) => (item.kind === 'file' && item.type.startsWith('image/') ? [i] : []));
}

export function pastedImageName(type: string, index: number): string {
  const ext = type.split('/')[1]?.split('+')[0] ?? 'png';
  return `pasted-image-${index + 1}.${ext}`;
}
