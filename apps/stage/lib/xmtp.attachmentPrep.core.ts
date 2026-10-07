import type { LocalAttachmentInput } from './xmtp.types';

type Files = readonly LocalAttachmentInput[];

export interface AttachmentPrep<R> {
  prepare: (files: Files) => void;
  upload: (files: Files) => void;
  uploaded: (files: Files) => Promise<R[]>;
  forget: (files: Files) => void;
}

export async function sendPreparedAttachment<R, C>(input: {
  assertCurrent: () => void;
  uploaded: () => Promise<R[]>;
  onUploaded?: (infos: R[]) => void;
  find: () => Promise<C>;
  send: (conv: C, infos: R[]) => Promise<string>;
}): Promise<string> {
  input.assertCurrent();
  const infos = await input.uploaded();
  input.assertCurrent();
  input.onUploaded?.(infos);
  input.assertCurrent();
  const conv = await input.find();
  input.assertCurrent();
  return input.send(conv, infos);
}

const ENCRYPTS_AT_ONCE = 2;
const UPLOADS_AT_ONCE = 3;

type Limit = <T>(run: () => Promise<T>) => Promise<T>;

function limitConcurrency(max: number): Limit {
  let active = 0;
  const waiting: (() => void)[] = [];
  return async <T>(run: () => Promise<T>): Promise<T> => {
    while (active >= max) await new Promise<void>((go) => { waiting.push(go); });
    active += 1;
    try {
      return await run();
    } finally {
      active -= 1;
      waiting.shift()?.();
    }
  };
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
  const encryptSlot = limitConcurrency(ENCRYPTS_AT_ONCE);
  const uploadSlot = limitConcurrency(UPLOADS_AT_ONCE);
  const encryptedOf = (file: LocalAttachmentInput): Promise<E> =>
    once(encrypted, keyOf(file), () => encryptSlot(() => encrypt(file)));
  const storedOf = (file: LocalAttachmentInput): Promise<R> => once(stored, keyOf(file), async () => {
    const ready = await encryptedOf(file);
    try {
      return await uploadSlot(() => store(ready, file));
    } catch (err) {
      encrypted.delete(keyOf(file));
      throw err;
    }
  });
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
