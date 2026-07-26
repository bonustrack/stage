
import { Opfs } from '@xmtp/browser-sdk';

export function deleteDbFiles(dbDirName: string): void {
  void deleteOpfsDbFiles(dbDirName);
}

async function deleteOpfsDbFiles(prefix: string): Promise<void> {
  try {
    const opfs = await Opfs.create();
    try {
      const files = await opfs.listFiles();
      for (const file of files) {
        const name = file.startsWith('/') ? file.slice(1) : file;
        if (name.startsWith(prefix)) await opfs.deleteFile(file);
      }
    } finally {
      opfs.close();
    }
  } catch { }
}

export function ensureDbDir(name: string): Promise<string> {
  return Promise.resolve(name);
}
