import { useEffect, useState } from 'react';
import { View } from '../layout/native';
import { HERO_BLACK, asciiPath } from './Landing.model';
import { useAsciiArt } from './useAsciiArt';

function sizeCanvas(canvas: HTMLCanvasElement, width: number, height: number): CanvasRenderingContext2D | null {
  const ratio = globalThis.devicePixelRatio || 1;
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const ctx = canvas.getContext('2d');
  ctx?.setTransform(ratio, 0, 0, ratio, 0, 0);
  return ctx;
}

function drawArt(ctx: CanvasRenderingContext2D, art: string, width: number, height: number): void {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = HERO_BLACK;
  ctx.fill(new Path2D(asciiPath(art, width, height)));
}

function useCanvas(host: HTMLElement | null): HTMLCanvasElement | null {
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  useEffect(() => {
    if (host === null) return;
    const el = document.createElement('canvas');
    el.style.position = 'absolute';
    el.style.top = '0';
    el.style.left = '0';
    host.appendChild(el);
    setCanvas(el);
    return (): void => { el.remove(); setCanvas(null); };
  }, [host]);
  return canvas;
}

export function AsciiField({ width, height }: { width: number; height: number }): React.ReactElement {
  const art = useAsciiArt(width, height);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const canvas = useCanvas(host);
  const [ctx, setCtx] = useState<CanvasRenderingContext2D | null>(null);
  useEffect(() => { setCtx(canvas === null ? null : sizeCanvas(canvas, width, height)); }, [canvas, width, height]);
  useEffect(() => { if (ctx !== null) drawArt(ctx, art, width, height); }, [ctx, art, width, height]);
  return (
    <View
      ref={(node) => { setHost(node as unknown as HTMLElement | null); }}
      pointerEvents="none"
      style={{ position: 'absolute', top: 0, left: 0, width, height, overflow: 'hidden' }}
    />
  );
}
