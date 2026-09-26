import type { BoardDrag, BoardDragSource, BoardDropZone } from './BoardScreen.model';

export function useBoardDragSource(drag: BoardDrag | null, imageId?: string): BoardDragSource {
  void drag;
  void imageId;
  return { nativeID: undefined, dragging: false };
}

export function useBoardDropZone(key: string, onDrop: (drag: BoardDrag) => void): BoardDropZone {
  void key;
  void onDrop;
  return { nativeID: undefined, over: false };
}
