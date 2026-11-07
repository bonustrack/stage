import { extensionForMime } from '@stage-labs/client/files';

const IMAGE_SUBTYPE = /^(?:data:)?image\/([a-z0-9.+-]+)/i;
const URL_EXTENSION = /\.([a-z0-9]{3,4})(?:[?#]|$)/i;

function subtypeOf(value: string | undefined): string | undefined {
  return value === undefined ? undefined : IMAGE_SUBTYPE.exec(value)?.[1]?.toLowerCase();
}

export function imageExtension(uri: string, mimeType?: string): string {
  const subtype = subtypeOf(mimeType) ?? subtypeOf(uri);
  if (subtype !== undefined) return extensionForMime(`image/${subtype}`, 'save') ?? subtype;
  return (URL_EXTENSION.exec(uri)?.[1] ?? 'jpg').toLowerCase();
}

export function imageFileName(uri: string, mimeType: string | undefined, now: number): string {
  return `image-${now}.${imageExtension(uri, mimeType)}`;
}
