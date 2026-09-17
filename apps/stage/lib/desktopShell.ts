import { Platform } from 'react-native';

interface DesktopBridge { titleBarInset?: unknown }

function bridge(): DesktopBridge | undefined {
  return (globalThis as { stageDesktop?: DesktopBridge }).stageDesktop;
}

export function desktopTitleBarInset(): number {
  if (Platform.OS !== 'web') return 0;
  const inset = bridge()?.titleBarInset;
  return typeof inset === 'number' && Number.isFinite(inset) && inset > 0 ? inset : 0;
}
