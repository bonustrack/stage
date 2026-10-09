export function plainCopyText(editable: boolean, selected: string): string | null {
  if (editable) return null;
  const text = selected.replace(/^\n+|\n+$/g, '');
  return text === '' ? null : text;
}
