interface DesktopBridge { titleBarInset?: unknown }

export function desktopTitleBarInset(): number {
  const inset = (globalThis as { stageDesktop?: DesktopBridge }).stageDesktop?.titleBarInset;
  return typeof inset === 'number' && Number.isFinite(inset) && inset > 0 ? inset : 0;
}
