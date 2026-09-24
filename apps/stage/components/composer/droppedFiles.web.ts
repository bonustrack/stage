import { useEffect, useId, useRef, useState } from 'react';
import { isFileDrag, leaveDragTarget, type DropZone, type DroppedFile } from './droppedFiles.model';

function visibleZone(id: string): HTMLElement | null {
  const zone = document.getElementById(id);
  return zone !== null && zone.getClientRects().length > 0 ? zone : null;
}

function inZone(zone: HTMLElement, target: EventTarget | null): boolean {
  return target instanceof Node && zone.contains(target);
}

function attached(target: EventTarget): boolean {
  return !(target instanceof Node) || target.isConnected;
}

function filesFrom(event: DragEvent): DroppedFile[] {
  return Array.from(event.dataTransfer?.items ?? [])
    .filter((item) => item.kind === 'file' && item.webkitGetAsEntry()?.isDirectory !== true)
    .map((item) => item.getAsFile())
    .filter((file) => file !== null)
    .map((file) => ({ uri: URL.createObjectURL(file), mime: file.type, name: file.name }));
}

function listen(id: string, onFiles: (files: DroppedFile[]) => void, setActive: (active: boolean) => void): () => void {
  let targets: EventTarget[] = [];
  const track = (next: EventTarget[]): void => {
    if ((targets.length > 0) !== (next.length > 0)) setActive(next.length > 0);
    targets = next;
  };
  const claim = (event: DragEvent): HTMLElement | null => {
    const zone = visibleZone(id);
    if (zone === null || !isFileDrag(event.dataTransfer?.types)) return null;
    event.preventDefault();
    return zone;
  };
  const onEnter = (event: DragEvent): void => {
    if (claim(event) !== null && event.target !== null) track([...targets, event.target]);
  };
  const onOver = (event: DragEvent): void => {
    const zone = claim(event);
    if (zone !== null && event.dataTransfer !== null) event.dataTransfer.dropEffect = inZone(zone, event.target) ? 'copy' : 'none';
  };
  const onLeave = (event: DragEvent): void => {
    if (event.target !== null) track(leaveDragTarget(targets, event.target, attached));
  };
  const onDrop = (event: DragEvent): void => {
    const zone = claim(event);
    track([]);
    if (zone === null || !inZone(zone, event.target)) return;
    const files = filesFrom(event);
    if (files.length > 0) onFiles(files);
  };
  const onKey = (event: KeyboardEvent): void => { if (event.key === 'Escape') track([]); };
  const ac = new AbortController();
  const opts = { signal: ac.signal };
  window.addEventListener('dragenter', onEnter, opts);
  window.addEventListener('dragover', onOver, opts);
  window.addEventListener('dragleave', onLeave, opts);
  window.addEventListener('drop', onDrop, opts);
  window.addEventListener('dragend', () => { track([]); }, opts);
  window.addEventListener('keydown', onKey, opts);
  return (): void => { ac.abort(); };
}

export function useDroppedFiles(onFiles: (files: DroppedFile[]) => void): DropZone {
  const zoneId = useId();
  const handler = useRef(onFiles);
  handler.current = onFiles;
  const [active, setActive] = useState(false);
  useEffect(() => listen(zoneId, (files) => { handler.current(files); }, setActive), [zoneId]);
  return { zoneId, active };
}
