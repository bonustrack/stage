import { mkdtempSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { BrowserWindow, app, dialog, ipcMain, shell, type IpcMainInvokeEvent } from 'electron';
import { sameSite } from './links';
import { MAX_OPEN_BYTES, OPEN_FILE_CHANNEL, opensInApp, savedFileName } from './openableFile';

async function saveWithDialog(event: IpcMainInvokeEvent, name: string, bytes: Uint8Array): Promise<void> {
  const options = { defaultPath: path.join(app.getPath('downloads'), name) };
  const win = BrowserWindow.fromWebContents(event.sender);
  const target = win === null ? await dialog.showSaveDialog(options) : await dialog.showSaveDialog(win, options);
  if (!target.canceled && target.filePath !== '') writeFileSync(target.filePath, bytes);
}

async function openFile(site: string, event: IpcMainInvokeEvent, name: unknown, bytes: unknown): Promise<void> {
  if (!sameSite(event.senderFrame?.url ?? '', site)) return;
  if (typeof name !== 'string' || !(bytes instanceof Uint8Array) || bytes.byteLength > MAX_OPEN_BYTES) return;
  const safe = savedFileName(name);
  if (!opensInApp(safe)) {
    await saveWithDialog(event, safe, bytes);
    return;
  }
  const file = path.join(mkdtempSync(path.join(app.getPath('temp'), 'stage-open-')), safe);
  writeFileSync(file, bytes);
  await shell.openPath(file);
}

export function serveFileOpening(site: string): void {
  ipcMain.handle(OPEN_FILE_CHANNEL, (event, name: unknown, bytes: unknown) => openFile(site, event, name, bytes));
}
