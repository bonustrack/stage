import { app, Menu, shell, type MenuItemConstructorOptions } from 'electron';
import { STAGE_ORIGIN } from '@stage-labs/client/endpoints';
import { checkForUpdatesNow } from './updates';

export function installMenu(): void {
  const mac = process.platform === 'darwin';
  const template: MenuItemConstructorOptions[] = [
    ...(mac ? [{ role: 'appMenu' } satisfies MenuItemConstructorOptions] : []),
    { role: 'fileMenu' },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    { role: 'windowMenu' },
    {
      role: 'help',
      submenu: [
        {
          label: 'Open stage.box in the browser',
          click: () => {
            void shell.openExternal(STAGE_ORIGIN);
          },
        },
        { type: 'separator' },
        { label: 'Check for Updates…', click: checkForUpdatesNow },
        { label: `Version ${app.getVersion()}`, enabled: false },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
