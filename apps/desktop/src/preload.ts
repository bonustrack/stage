import { contextBridge } from 'electron';
import { TITLE_BAR_HEIGHT } from './titleBar';

contextBridge.exposeInMainWorld('stageDesktop', { titleBarInset: TITLE_BAR_HEIGHT, platform: process.platform });
