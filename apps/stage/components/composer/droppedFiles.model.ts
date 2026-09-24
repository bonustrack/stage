export interface DroppedFile {
  uri: string;
  mime: string;
  name: string;
}

export interface DropZone {
  zoneId: string | undefined;
  active: boolean;
}

export function isFileDrag(types: readonly string[] | undefined): boolean {
  return types?.includes('Files') === true;
}

export function leaveDragTarget<T>(targets: readonly T[], target: T, attached: (t: T) => boolean): T[] {
  return targets.filter((t) => t !== target && attached(t));
}
