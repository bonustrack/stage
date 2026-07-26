
export interface Attachment {
  id: string; url: string; kind: string; mime: string; size: number; name?: string;
}

export interface Palette { fg: string; sub: string; inputBg: string; chipBg: string }

export const INLINE_ATTACHMENT_MAX_BYTES = 900 * 1024;
