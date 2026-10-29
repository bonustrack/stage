import { bytesToBase64 } from '@stage-labs/client/text/base64';
import type { Attachment } from './types';

export const COMPOSER_TEXT_BYTE_LIMIT = 4096;

export function textAttachment(text: string, mintId: () => string): Attachment | null {
  const bytes = new TextEncoder().encode(text);
  if (bytes.length <= COMPOSER_TEXT_BYTE_LIMIT) return null;
  return {
    id: mintId(),
    kind: 'file',
    name: 'message.txt',
    mime: 'text/plain',
    size: bytes.length,
    url: `data:text/plain;base64,${bytesToBase64(bytes)}`,
  };
}
