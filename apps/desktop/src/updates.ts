import { app, dialog, shell } from 'electron';
import { autoUpdater, type UpdateInfo } from 'electron-updater';
import { installsInPlace, releasePageUrl, UPDATE_CHECK_INTERVAL_MS } from './updateModel';

let manualCheck = false;
let offeredVersion = '';

function check(): void {
  void autoUpdater.checkForUpdates().catch(() => undefined);
}

function offerDownload(info: UpdateInfo): void {
  if (!manualCheck && offeredVersion === info.version) return;
  offeredVersion = info.version;
  manualCheck = false;
  void dialog.showMessageBox({
    type: 'info',
    message: `Stage ${info.version} is available`,
    detail: 'Download the new version from the releases page and replace the app to update.',
    buttons: ['Download', 'Later'],
    defaultId: 0,
    cancelId: 1,
  }).then(({ response }) => {
    if (response === 0) void shell.openExternal(releasePageUrl(info.version));
  });
}

function offerRestart(info: UpdateInfo): void {
  manualCheck = false;
  void dialog.showMessageBox({
    type: 'info',
    message: `Stage ${info.version} is ready to install`,
    detail: 'Restart Stage to finish updating.',
    buttons: ['Restart now', 'Later'],
    defaultId: 0,
    cancelId: 1,
  }).then(({ response }) => {
    if (response === 0) autoUpdater.quitAndInstall();
  });
}

function reportUpToDate(): void {
  if (!manualCheck) return;
  manualCheck = false;
  void dialog.showMessageBox({ type: 'info', message: `Stage ${app.getVersion()} is up to date`, buttons: ['OK'] });
}

function reportError(error: Error): void {
  if (!manualCheck) return;
  manualCheck = false;
  void dialog.showMessageBox({
    type: 'error',
    message: 'Could not check for updates',
    detail: error.message,
    buttons: ['OK'],
  });
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
