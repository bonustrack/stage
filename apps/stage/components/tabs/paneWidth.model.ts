const MIN_WIDTH_SNAP_PX = 4;

export function isMinWidth(width: number, min: number): boolean {
  return width - min <= MIN_WIDTH_SNAP_PX;
}
