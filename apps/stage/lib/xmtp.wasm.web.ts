import { contentTypeText } from '@xmtp/browser-sdk';

let mainThreadWasm: Promise<unknown> | null = null;

function loadMainThreadWasm(): Promise<unknown> {
  mainThreadWasm ??= contentTypeText().catch((e: unknown) => {
    mainThreadWasm = null;
    throw e;
  });
  return mainThreadWasm;
}

export async function withMainThreadWasm<T>(run: () => Promise<T>): Promise<T> {
  await loadMainThreadWasm();
  return run();
}
