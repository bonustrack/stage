export interface StageDesktopBridge {
  titleBarInset: number;
  openFile: (name: string, bytes: Uint8Array) => Promise<boolean>;
}

export interface DesktopBridgeGlobal {
  stageDesktop?: Partial<StageDesktopBridge>;
}
