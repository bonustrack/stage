export function boardCardShowsPreview(enabled: boolean, lastPreview: string | null | undefined, draftText: string): boolean {
  return enabled && ((lastPreview ?? '').length > 0 || draftText.trim().length > 0);
}
