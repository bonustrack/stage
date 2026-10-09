import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { app, ipcMain, shell, type IpcMainInvokeEvent } from 'electron';
import { sameSite } from './links';
import { MAX_OPEN_BYTES, OPEN_FILE_CHANNEL, TEMP_PREFIX, opensInApp, savedFileName } from './openableFile';

async function openFile(site: string, event: IpcMainInvokeEvent, name: unknown, bytes: unknown): Promise<boolean> {
  if (!sameSite(event.senderFrame?.url ?? '', site)) throw new Error('Files can only be opened from the Stage window.');
  if (typeof name !== 'string' || !(bytes instanceof Uint8Array)) throw new Error('Could not read this file.');
  if (bytes.byteLength > MAX_OPEN_BYTES) throw new Error('This file is too large to open.');
  const safe = savedFileName(name);
  if (!opensInApp(safe)) return false;
  const file = path.join(await mkdtemp(path.join(app.getPath('temp'), TEMP_PREFIX)), safe);
  await writeFile(file, bytes);
  const failure = await shell.openPath(file);
  if (failure !== '') throw new Error(failure);
  return true;
}

async function clearOldCopies(): Promise<void> {
  const temp = app.getPath('temp');
  const [listed] = await Promise.allSettled([readdir(temp)]);
  const names = listed.status === 'fulfilled' ? listed.value : [];
  await Promise.allSettled(names.filter((entry) => entry.startsWith(TEMP_PREFIX)).map((entry) => rm(path.join(temp, entry), { recursive: true, force: true })));
}

export function serveFileOpening(site: string): void {
  void clearOldCopies();
  ipcMain.handle(OPEN_FILE_CHANNEL, (event, name: unknown, bytes: unknown) => openFile(site, event, name, bytes));
}
