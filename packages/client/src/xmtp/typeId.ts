export function shortTypeId(contentTypeId: string | undefined | null): string {
  if (!contentTypeId) return '';
  return contentTypeId.split('/').pop()?.split(':')[0] ?? contentTypeId;
}
