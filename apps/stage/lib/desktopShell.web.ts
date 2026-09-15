interface DesktopBridge { titleBarInset?: unknown }

function bridge(): DesktopBridge | undefined {
  return (globalThis as { stageDesktop?: DesktopBridge }).stageDesktop;
}

export function desktopTitleBarInset(): number {
  const inset = bridge()?.titleBarInset;
  return typeof inset === 'number' && Number.isFinite(inset) && inset > 0 ? inset : 0;
}

export function inBrowser(): boolean {
  return bridge() === undefined;
}
