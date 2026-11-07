import { contextBridge, ipcRenderer } from 'electron';
import type { DesktopBridgeGlobal, StageDesktopBridge } from '../../lib/desktopBridge';
import { OPEN_FILE_CHANNEL } from './openableFile';
import { TITLE_BAR_HEIGHT } from './titleBar';

const BRIDGE_KEY: keyof DesktopBridgeGlobal = 'stageDesktop';

const bridge: StageDesktopBridge = {
  titleBarInset: TITLE_BAR_HEIGHT,
  openFile: async (name, bytes) => {
    const opened: unknown = await ipcRenderer.invoke(OPEN_FILE_CHANNEL, name, bytes);
    return opened === true;
  },
};

contextBridge.exposeInMainWorld(BRIDGE_KEY, bridge);
