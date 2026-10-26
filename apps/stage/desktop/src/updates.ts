import { app, dialog, shell, type MessageBoxOptions } from 'electron';
import { autoUpdater, type UpdateInfo } from 'electron-updater';
import { installsInPlace, releasePageUrl, UPDATE_CHECK_INTERVAL_MS } from './updateModel';

let manualCheck = false;
let offeredVersion = '';

function check(): void {
  void autoUpdater.checkForUpdates().catch(() => undefined);
}

function ask(message: string, detail: string, accept: string, onAccept: () => void): void {
  void dialog.showMessageBox({ type: 'info', message, detail, buttons: [accept, 'Later'], defaultId: 0, cancelId: 1 })
    .then(({ response }) => { if (response === 0) onAccept(); });
}

function offerDownload(info: UpdateInfo): void {
  if (!manualCheck && offeredVersion === info.version) return;
  offeredVersion = info.version;
  manualCheck = false;
  ask(`Stage ${info.version} is available`, 'Download the new version from the releases page and replace the app to update.', 'Download',
    () => { void shell.openExternal(releasePageUrl(info.version)); });
}

function offerRestart(info: UpdateInfo): void {
  manualCheck = false;
  ask(`Stage ${info.version} is ready to install`, 'Restart Stage to finish updating.', 'Restart now', () => { autoUpdater.quitAndInstall(); });
}

function tellManualCheck(options: MessageBoxOptions): void {
  if (!manualCheck) return;
  manualCheck = false;
  void dialog.showMessageBox(options);
}

function reportUpToDate(): void {
  tellManualCheck({ type: 'info', message: `Stage ${app.getVersion()} is up to date`, buttons: ['OK'] });
}

function reportError(error: Error): void {
  tellManualCheck({ type: 'error', message: 'Could not check for updates', detail: error.message, buttons: ['OK'] });
}

export function startUpdates(): void {
  if (!app.isPackaged) return;
  autoUpdater.autoDownload = installsInPlace(process.platform);
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('update-available', (info) => {
    if (!autoUpdater.autoDownload) offerDownload(info);
  });
  autoUpdater.on('update-downloaded', offerRestart);
  autoUpdater.on('update-not-available', reportUpToDate);
  autoUpdater.on('error', reportError);
  check();
  setInterval(check, UPDATE_CHECK_INTERVAL_MS);
}

export function checkForUpdatesNow(): void {
  if (!app.isPackaged) {
    void dialog.showMessageBox({ type: 'info', message: 'Updates are only checked in the installed app', buttons: ['OK'] });
    return;
  }
  manualCheck = true;
  check();
}
