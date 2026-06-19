/**
 * @file Composable that stages a composer image attachment as a pending preview and flushes it as an XMTP attachment on send.
 */
/** Composer attachment handling — stage an image (paste or file pick) as a pending preview, then flush it as an XMTP attachment on send. Pulled out of Composer.vue to keep that file under the per-file LOC cap. */

import { ref } from 'vue';
import { xmtpSendAttachment } from './xmtpSend';

/** Hook for staging a composer image attachment as a pending preview and flushing it on send. */
export function useComposerAttach(getLine: () => string, onError: (m: string) => void) {
  const pending = ref<{ file: File; url: string } | null>(null);

  /** Stage helper. */
  function stage(file: File): void {
    if (pending.value) URL.revokeObjectURL(pending.value.url);
    pending.value = { file, url: URL.createObjectURL(file) };
  }

  /** Clear helper. */
  function clear(): void {
    if (pending.value) URL.revokeObjectURL(pending.value.url);
    pending.value = null;
  }

  /** Handle the Paste. */
  function onPaste(ev: ClipboardEvent): void {
    const item = Array.from(ev.clipboardData?.items ?? []).find(i => i.type.startsWith('image/'));
    const file = item?.getAsFile();
    if (!file) return;
    ev.preventDefault();
    stage(file);
  }

  /** Handle the File Change. */
  function onFileChange(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) stage(file);
  }

  /** Upload + send the staged image (if any), then clear it. */
  async function flush(): Promise<void> {
    const staged = pending.value;
    if (!staged) return;
    const dataB64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (): void => {
        const r = reader.result;
        if (typeof r !== 'string') { reject(new Error('FileReader returned non-string')); return; }
        const comma = r.indexOf(',');
        resolve(comma === -1 ? r : r.slice(comma + 1));
      };
      reader.onerror = (): void => { reject(reader.error ?? new Error('FileReader failed')); };
      reader.readAsDataURL(staged.file);
    });
    try {
      await xmtpSendAttachment(getLine(), staged.file.name || 'image', staged.file.type || 'application/octet-stream', dataB64);
      clear();
    } catch (e) { onError((e as Error).message); }
  }

  return { pending, clear, onPaste, onFileChange, flush };
}
