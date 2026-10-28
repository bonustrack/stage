import type { ArgType } from '../gallery/story';
import { Column } from '../src/react-native/column';
import { Text } from '../src/react-native/text';
import { FONT_SIZE, type FontSizeName } from '../src/tokens';

export function select<const T extends string | number>(options: readonly T[]): ArgType<T> {
  return { control: { type: 'select' }, options: [...options] };
}

export function range(min: number, max: number, step = 1): ArgType<number> {
  return { control: { type: 'range', min, max, step } };
}

export const bool: ArgType<boolean> = { control: { type: 'boolean' } };
export const text: ArgType<string> = { control: { type: 'text' } };
export const number: ArgType<number> = { control: { type: 'number' } };
export const color: ArgType<string> = { control: { type: 'color' } };

export const FONT_SIZES = Object.keys(FONT_SIZE) as FontSizeName[];
export const CONTROL_SIZES = ['xs', 'sm', 'md', 'lg', 'xl'] as const;
export const CONTROL_VARIANTS = ['soft', 'outline'] as const;
export { COLOR_TOKENS } from '../src/tokens';
export const ALIGNS = ['start', 'center', 'end'] as const;
export const RADII = ['none', '2xs', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl', 'full'] as const;
export const JUSTIFY = ['start', 'center', 'end', 'spaceBetween', 'spaceAround', 'spaceEvenly', 'stretch'] as const;
export const SURFACES = ['none', 'surface', 'raised', 'sunken', 'toolbar'] as const;

export const FLEX_ARG_TYPES = {
  gap: number, padding: number, margin: number, align: select(['start', 'center', 'end', 'stretch']), justify: select(JUSTIFY),
  weight: number, wrap: bool, surface: select(SURFACES), background: color, radius: select(RADII),
  width: text, height: text, minWidth: text, minHeight: text, maxWidth: text, maxHeight: text, aspectRatio: number,
};

export function Cell({ label, background }: { label: string; background: string }): React.ReactElement {
  return <Column padding={8} background={background} radius="sm"><Text color="#ffffff">{label}</Text></Column>;
}

export { useDark } from '../gallery/scheme';

export function svgSwatch(fill: string, label = '', width = 200, height = 200): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" fill="${fill}"/><text x="${width / 2}" y="${height / 2 + 18}" font-size="72" text-anchor="middle" fill="#fff" font-family="sans-serif">${label}</text></svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

export function silentWav(seconds = 2): string {
  const rate = 8000;
  const samples = rate * seconds;
  const buffer = new ArrayBuffer(44 + samples);
  const view = new DataView(buffer);
  const ascii = (offset: number, s: string): void => { for (let i = 0; i < s.length; i += 1) view.setUint8(offset + i, s.charCodeAt(i)); };
  ascii(0, 'RIFF'); view.setUint32(4, 36 + samples, true); ascii(8, 'WAVE'); ascii(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, rate, true); view.setUint32(28, rate, true); view.setUint16(32, 1, true); view.setUint16(34, 8, true);
  ascii(36, 'data'); view.setUint32(40, samples, true);
  for (let i = 0; i < samples; i += 1) view.setUint8(44 + i, 128 + Math.round(Math.sin(i / 20) * 40));
  let binary = '';
  new Uint8Array(buffer).forEach((b) => { binary += String.fromCharCode(b); });
  return `data:audio/wav;base64,${btoa(binary)}`;
}
