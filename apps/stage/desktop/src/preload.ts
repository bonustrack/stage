import { contextBridge, ipcRenderer } from 'electron';
import { OPEN_FILE_CHANNEL } from './openableFile';
import { TITLE_BAR_HEIGHT } from './titleBar';

contextBridge.exposeInMainWorld('stageDesktop', {
  titleBarInset: TITLE_BAR_HEIGHT,
  platform: process.platform,
  openFile: async (name: string, bytes: Uint8Array): Promise<boolean> => {
    const opened: unknown = await ipcRenderer.invoke(OPEN_FILE_CHANNEL, name, bytes);
    return opened === true;
  },
});
