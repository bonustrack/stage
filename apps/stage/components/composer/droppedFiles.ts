import type { DropZone, DroppedFile } from './droppedFiles.model';

export function useDroppedFiles(onFiles: (files: DroppedFile[], keepFocus: boolean) => void): DropZone {
  void onFiles;
  return { zoneId: undefined, active: false };
}
