import path from 'node:path';
import { BrowserWindow, shell } from 'electron';
import { sameSite } from './links';
import { TITLE_BAR_HEIGHT } from './titleBar';

const BACKGROUND = '#0e0e10';
const mac = process.platform === 'darwin';

function openOutside(url: string): void {
  if (/^https?:/i.test(url)) void shell.openExternal(url);
}

function guardNavigation(win: BrowserWindow, site: string): void {
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (sameSite(url, site)) void win.loadURL(url);
    else openOutside(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (sameSite(url, site)) return;
    event.preventDefault();
    openOutside(url);
  });
}

export function createWindow(site: string, url: string): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 400,
    minHeight: 600,
    show: false,
    title: 'Stage',
    backgroundColor: BACKGROUND,
    titleBarStyle: mac ? 'hiddenInset' : 'hidden',
    trafficLightPosition: { x: 12, y: 8 },
    ...(mac ? {} : { titleBarOverlay: { color: BACKGROUND, symbolColor: '#e4e4e7', height: TITLE_BAR_HEIGHT } }),
    webPreferences: {
      contextIsolation: true, sandbox: true, nodeIntegration: false, spellcheck: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });
  win.once('ready-to-show', () => { win.show(); });
  guardNavigation(win, site);
  void win.loadURL(url);
  return win;
}

export function frontWindow(): BrowserWindow | null {
  return BrowserWindow.getAllWindows()[0] ?? null;
}
