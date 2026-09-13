import path from 'node:path';
import { app, BrowserWindow, session, systemPreferences } from 'electron';
import { DEEP_LINK_SCHEME, deepLinkIn, desktopRouteUrl, sameSite, siteBaseFor } from './links';
import { installMenu } from './menu';
import { registerAppScheme, serveWebApp } from './serve';
import { createWindow, frontWindow } from './window';

const ALLOWED_PERMISSIONS = new Set([
  'notifications', 'media', 'clipboard-read', 'clipboard-sanitized-write', 'fullscreen',
]);

const remoteUi = process.env.STAGE_DESKTOP_URL;
const site = siteBaseFor(remoteUi);
let pendingLink = deepLinkIn(process.argv);

function openLink(link: string): void {
  const win = frontWindow();
  if (win === null) {
    createWindow(site, desktopRouteUrl(site, link));
    return;
  }
  if (win.isMinimized()) win.restore();
  win.focus();
  void win.loadURL(desktopRouteUrl(site, link));
}

async function systemMediaAccess(kinds: readonly ('video' | 'audio')[]): Promise<boolean> {
  if (process.platform !== 'darwin') return true;
  const granted = await Promise.all(
    kinds.map((kind) => systemPreferences.askForMediaAccess(kind === 'video' ? 'camera' : 'microphone')),
  );
  return granted.every(Boolean);
}

function restrictPermissions(): void {
  const allowed = (permission: string, origin: string): boolean =>
    ALLOWED_PERMISSIONS.has(permission) && sameSite(origin, site);
  session.defaultSession.setPermissionRequestHandler((_contents, permission, callback, details) => {
    if (!allowed(permission, details.requestingUrl)) { callback(false); return; }
    if (permission !== 'media') { callback(true); return; }
    void systemMediaAccess('mediaTypes' in details ? details.mediaTypes ?? [] : []).then(callback);
  });
  session.defaultSession.setPermissionCheckHandler((_contents, permission, origin, details) =>
    allowed(permission, origin !== '' ? origin : details.embeddingOrigin ?? ''));
}

function webRoot(): string {
  return app.isPackaged ? path.join(process.resourcesPath, 'web') : path.join(app.getAppPath(), 'web');
}

function start(): void {
  registerAppScheme();
  if (app.isPackaged) app.setAsDefaultProtocolClient(DEEP_LINK_SCHEME);
  app.on('second-instance', (_event, argv) => {
    const link = deepLinkIn(argv);
    if (link !== null) openLink(link);
    else frontWindow()?.focus();
  });
  app.on('open-url', (event, url) => {
    event.preventDefault();
    if (app.isReady()) openLink(url);
    else pendingLink = url;
  });
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow(site, site);
  });
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
  void app.whenReady().then(() => {
    if (remoteUi === undefined || remoteUi === '') serveWebApp(webRoot());
    restrictPermissions();
    installMenu();
    createWindow(site, pendingLink === null ? site : desktopRouteUrl(site, pendingLink));
    pendingLink = null;
  });
}

if (app.requestSingleInstanceLock()) start();
else app.quit();
