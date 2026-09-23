import { useEffect, useState } from 'react';
import { View } from '../layout/native';
import { ASCII, ASCII_GLYPH, HERO_BLACK, asciiOrigin, glyphRect } from './Landing.model';
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

function addCaret(ctx: CanvasRenderingContext2D, x: number, baseline: number): void {
  const { left, right, top, bottom, leg, apex } = ASCII_GLYPH.caret;
  const mid = x + (left + right) / 2;
  const foot = baseline - bottom;
  const peak = baseline - top;
  ctx.moveTo(x + left, foot);
  ctx.lineTo(mid, peak);
  ctx.lineTo(x + right, foot);
  ctx.lineTo(x + right - leg, foot);
  ctx.lineTo(mid, peak + apex);
  ctx.lineTo(x + left + leg, foot);
  ctx.closePath();
}

function drawLine(ctx: CanvasRenderingContext2D, line: string, originX: number, baseline: number): void {
  for (let col = 0; col < line.length; col += 1) {
    const ch = line[col] ?? ' ';
    const x = originX + col * ASCII_GLYPH.pitch;
    if (ch === '^') { addCaret(ctx, x, baseline); continue; }
    const rect = glyphRect(ch, x, baseline);
    if (rect !== null) ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
  }
}

function drawArt(ctx: CanvasRenderingContext2D, art: string, width: number, height: number): void {
  const lines = art.split('\n');
  const origin = asciiOrigin(width, height, lines[0]?.length ?? 0, lines.length);
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = HERO_BLACK;
  ctx.beginPath();
  lines.forEach((line, row) => {
    drawLine(ctx, line, origin.x, origin.y + row * ASCII.lineHeight + ASCII_GLYPH.baseline);
  });
  ctx.fill();
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
