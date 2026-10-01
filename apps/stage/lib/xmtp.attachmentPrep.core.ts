import type { LocalAttachmentInput } from './xmtp.types';

type Files = readonly LocalAttachmentInput[];

export interface AttachmentPrep<R> {
  prepare: (files: Files) => void;
  upload: (files: Files) => void;
  uploaded: (files: Files) => Promise<R[]>;
  forget: (files: Files) => void;
}

function keyOf(file: LocalAttachmentInput): string {
  return `${file.fileUri}\n${file.mimeType}\n${file.filename}`;
}

function once<T>(jobs: Map<string, Promise<T>>, key: string, run: () => Promise<T>): Promise<T> {
  const running = jobs.get(key);
  if (running) return running;
  const job = run();
  jobs.set(key, job);
  job.catch(() => { if (jobs.get(key) === job) jobs.delete(key); });
  return job;
}

export function makeAttachmentPrep<E, R>(
  encrypt: (file: LocalAttachmentInput) => Promise<E>,
  store: (encrypted: E, file: LocalAttachmentInput) => Promise<R>,
): AttachmentPrep<R> {
  const encrypted = new Map<string, Promise<E>>();
  const stored = new Map<string, Promise<R>>();
  const encryptedOf = (file: LocalAttachmentInput): Promise<E> => once(encrypted, keyOf(file), () => encrypt(file));
  const storedOf = (file: LocalAttachmentInput): Promise<R> =>
    once(stored, keyOf(file), async () => store(await encryptedOf(file), file));
  return {
    prepare: (files) => { for (const file of files) void encryptedOf(file); },
    upload: (files) => { for (const file of files) void storedOf(file); },
    uploaded: (files) => Promise.all(files.map(storedOf)),
    forget: (files) => {
      for (const file of files) {
        encrypted.delete(keyOf(file));
        stored.delete(keyOf(file));
      }
    },
  };
}
