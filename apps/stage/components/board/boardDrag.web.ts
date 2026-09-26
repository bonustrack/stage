import { useEffect, useId, useRef, useState } from 'react';
import { isCoarsePointer } from '../../lib/webLayout';
import { acceptsDrop, type BoardDrag, type BoardDragSource, type BoardDropZone } from './BoardScreen.model';

const BOARD_MIME = 'application/x-stage-board';

let active: BoardDrag | null = null;

function nodeOf(id: string | undefined): HTMLElement | null {
  return id === undefined ? null : document.getElementById(id);
}

function startDrag(event: DragEvent, drag: BoardDrag, image: HTMLElement): void {
  active = drag;
  const data = event.dataTransfer;
  if (data === null) return;
  data.effectAllowed = 'move';
  data.setData(BOARD_MIME, JSON.stringify(drag));
  const rect = image.getBoundingClientRect();
  data.setDragImage(image, event.clientX - rect.left, event.clientY - rect.top);
}

function listenSource(
  node: HTMLElement, drag: () => BoardDrag | null, imageId: string | undefined, setDragging: (dragging: boolean) => void,
): () => void {
  const ac = new AbortController();
  const opts = { signal: ac.signal };
  node.draggable = true;
  node.style.cursor = 'grab';
  node.addEventListener('dragstart', (event) => {
    const current = drag();
    if (current === null) return;
    startDrag(event, current, nodeOf(imageId) ?? node);
    requestAnimationFrame(() => { setDragging(true); });
  }, opts);
  node.addEventListener('dragend', () => { active = null; setDragging(false); }, opts);
  return (): void => {
    ac.abort();
    node.removeAttribute('draggable');
    node.style.cursor = '';
  };
}

function inside(node: HTMLElement, event: DragEvent): boolean {
  const rect = node.getBoundingClientRect();
  return event.clientX > rect.left && event.clientX < rect.right && event.clientY > rect.top && event.clientY < rect.bottom;
}

function listenZone(
  node: HTMLElement, key: string, onDrop: (drag: BoardDrag) => void, setOver: (over: boolean) => void,
): () => void {
  const ac = new AbortController();
  const opts = { signal: ac.signal };
  const claim = (event: DragEvent): BoardDrag | null => {
    if (active === null || !acceptsDrop(active, key)) return null;
    event.preventDefault();
    if (event.dataTransfer !== null) event.dataTransfer.dropEffect = 'move';
    return active;
  };
  node.addEventListener('dragenter', (event) => { if (claim(event) !== null) setOver(true); }, opts);
  node.addEventListener('dragover', (event) => { setOver(claim(event) !== null); }, opts);
  node.addEventListener('dragleave', (event) => { if (!inside(node, event)) setOver(false); }, opts);
  node.addEventListener('drop', (event) => {
    const drag = claim(event);
    setOver(false);
    if (drag !== null) onDrop(drag);
  }, opts);
  window.addEventListener('dragend', () => { setOver(false); }, opts);
  return (): void => { ac.abort(); };
}

export function useBoardDragSource(drag: BoardDrag | null, imageId?: string): BoardDragSource {
  const id = useId();
  const current = useRef(drag);
  current.current = drag;
  const [dragging, setDragging] = useState(false);
  const enabled = drag !== null && !isCoarsePointer();
  useEffect(() => {
    const node = enabled ? nodeOf(id) : null;
    return node === null ? undefined : listenSource(node, () => current.current, imageId, setDragging);
  }, [enabled, id, imageId]);
  return { nativeID: enabled ? id : undefined, dragging };
}

export function useBoardDropZone(key: string, onDrop: (drag: BoardDrag) => void): BoardDropZone {
  const id = useId();
  const handler = useRef(onDrop);
  handler.current = onDrop;
  const [over, setOver] = useState(false);
  const enabled = !isCoarsePointer();
  useEffect(() => {
    const node = enabled ? nodeOf(id) : null;
    return node === null ? undefined : listenZone(node, key, (drag) => { handler.current(drag); }, setOver);
  }, [enabled, id, key]);
  return { nativeID: enabled ? id : undefined, over };
}
