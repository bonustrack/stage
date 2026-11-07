import { afterEach, describe, expect, test } from 'bun:test';
import { downloadFile } from '../lib/fileDownload.web';

const originals = (['document', 'fetch'] as const).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);

afterEach(() => {
  for (const [key, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
});

function savedNames(): string[] {
  const names: string[] = [];
  const link = {
    href: '',
    download: '',
    click: () => {
      names.push(link.download);
    },
    remove: () => undefined,
  };
  Object.defineProperty(globalThis, 'document', {
    value: { createElement: () => link, body: { appendChild: () => link } },
    configurable: true,
  });
  Object.defineProperty(globalThis, 'fetch', { value: () => Promise.resolve(new Response('bytes')), configurable: true });
  return names;
}

describe('downloadFile', () => {
  test('saves under a cleaned name whatever the caller passes', async () => {
    const names = savedNames();
    await downloadFile('data:application/pdf;base64,AA==', 'invoice\u202efdp.exe', 'application/octet-stream');
    await downloadFile('data:application/pdf;base64,AA==', 'r/../report', 'application/pdf');
    await downloadFile('data:text/plain;base64,AA==', 'CON.txt');
    await downloadFile('data:text/plain;base64,AA==', '..');
    expect(names).toEqual(['invoice_fdp.exe', 'r_.._report.pdf', '_CON.txt', 'attachment']);
  });
});
