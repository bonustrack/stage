import { useEffect, useState } from 'react';
import { Asset } from 'expo-asset';
import { KIT_FONT_STYLE_ID, KIT_FONTS } from '@stage-labs/kit/react-native/fonts';
import { fontName } from '@stage-labs/kit/tokens';
import cereal from '../assets/fonts/airbnb-cereal-vf.woff2';
import anthropicSans from '../assets/fonts/claude-anthropic-sans-var.woff2';
import dmSans400 from '../assets/fonts/databricks-dmsans-400.woff2';
import dmSans700 from '../assets/fonts/databricks-dmsans-700.woff2';
import openaiSans400 from '../assets/fonts/chatgpt-openaisans-400.woff2';
import openaiSans700 from '../assets/fonts/chatgpt-openaisans-700.woff2';
import atlasGrotesk400 from '../assets/fonts/dropbox-atlasgrotesk-400.woff2';
import atlasGrotesk500 from '../assets/fonts/dropbox-atlasgrotesk-500.woff2';
import saans400 from '../assets/fonts/intercom-saans-400.woff2';
import saans500 from '../assets/fonts/intercom-saans-500.woff2';
import mobbinSaans from '../assets/fonts/mobbin-saans-var.woff2';
import spotifyMix400 from '../assets/fonts/spotify-spotifymixui-400.woff2';
import spotifyMix700 from '../assets/fonts/spotify-spotifymixui-700.woff2';
import sohne from '../assets/fonts/stripe-sohne-var.woff2';
import tiktokFontBold from '../assets/fonts/tiktok-tiktokfont-bold.woff2';
import tiktokFontRegular from '../assets/fonts/tiktok-tiktokfont-regular.woff2';
import { DEFAULT_FONT, FONT_CHOICES, fontChoice, type FontChoice, type FontPreviewScope } from './fontChoice';
import { recover, reported } from './errorPolicy';

type FontSource = Parameters<typeof Asset.fromModule>[0] | { local: readonly string[] };

interface KitFont {
  sans: FontSource;
  head: FontSource;
  scale: number;
  weights?: readonly [string, string];
}

const VARIABLE = ['400', '600'] as const;

const SF_PRO = ['system-ui', '-apple-system', 'System Font', 'System Font Regular'];

const KIT_FONT_FACES: Record<FontChoice, KitFont> = {
  calibre: {
    sans: KIT_FONTS[fontName.sans] ?? { local: [fontName.sans] },
    head: KIT_FONTS[fontName.head] ?? { local: [fontName.head] },
    scale: 1,
  },
  chatgpt: { sans: openaiSans400, head: openaiSans700, scale: 0.88 },
  spotify: { sans: spotifyMix400, head: spotifyMix700, scale: 0.88 },
  intercom: { sans: saans400, head: saans500, scale: 0.85 },
  dropbox: { sans: atlasGrotesk400, head: atlasGrotesk500, scale: 0.82 },
  databricks: { sans: dmSans400, head: dmSans700, scale: 0.89 },
  tiktok: { sans: tiktokFontRegular, head: tiktokFontBold, scale: 0.86 },
  claude: { sans: anthropicSans, head: anthropicSans, scale: 0.85, weights: VARIABLE },
  airbnb: { sans: cereal, head: cereal, scale: 0.86, weights: VARIABLE },
  stripe: { sans: sohne, head: sohne, scale: 0.85, weights: VARIABLE },
  mobbin: { sans: mobbinSaans, head: mobbinSaans, scale: 0.85, weights: VARIABLE },
  apple: {
    sans: { local: [...SF_PRO, 'Segoe UI', 'Roboto'] },
    head: { local: [...SF_PRO, 'Segoe UI Semibold', 'Roboto Medium'] },
    scale: 0.87,
    weights: VARIABLE,
  },
};

const CALIBRE_ASCENT = 80;
const CALIBRE_DESCENT = 20;
const CALIBRE_LINE_GAP = 20;

const percent = (value: number): string => `${String(Math.round(value * 10) / 10)}%`;

function sourceOf(font: FontSource): string {
  if (typeof font === 'object' && 'local' in font) return font.local.map((name) => `local("${name}")`).join(', ');
  return `url("${Asset.fromModule(font).uri}")`;
}

function faceRule(family: string, font: FontSource, scale: number, weight = '100 900'): string {
  const lines =
    scale === 1
      ? ''
      : ` ascent-override: ${percent(CALIBRE_ASCENT / scale)}; descent-override: ${percent(CALIBRE_DESCENT / scale)}; line-gap-override: ${percent(CALIBRE_LINE_GAP / scale)};`;
  return `@font-face { font-family: "${family}"; src: ${sourceOf(font)}; font-weight: ${weight}; font-display: swap; size-adjust: ${percent(scale * 100)};${lines} }`;
}

function styleSheet(id: string): HTMLStyleElement {
  const found = document.getElementById(id);
  if (found instanceof HTMLStyleElement) return found;
  const sheet = document.createElement('style');
  sheet.id = id;
  document.head.append(sheet);
  return sheet;
}

async function applyFont(choice: FontChoice): Promise<void> {
  const font = KIT_FONT_FACES[choice];
  styleSheet(KIT_FONT_STYLE_ID).textContent = [
    faceRule(fontName.sans, font.sans, font.scale, font.weights?.[0]),
    faceRule(fontName.head, font.head, font.scale, font.weights?.[1]),
  ].join('\n');
  await Promise.all([fontName.sans, fontName.head].map((family) => document.fonts.load(`16px "${family}"`))).catch(reported('fonts.load'));
}

async function startFonts(): Promise<void> {
  const choice = await fontChoice.load().catch(recover('fonts.choice', DEFAULT_FONT));
  fontChoice.subscribe(() => {
    void applyFont(fontChoice.get());
  });
  await applyFont(choice);
}

let started: Promise<void> | null = null;

const fontsReady = (): Promise<void> => (started ??= startFonts());

export function bootKitFonts(): void {
  void fontsReady();
}

export function useKitFontsLoaded(): boolean {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    void fontsReady().then(() => {
      setLoaded(true);
    });
  }, []);
  return loaded;
}

const previewFamily = (choice: FontChoice): string => `Stage Font ${choice}`;

function addPreviews(): void {
  const sheet = styleSheet('stage-font-previews');
  if (sheet.textContent) return;
  sheet.textContent = FONT_CHOICES.map(({ id }) => {
    const font = KIT_FONT_FACES[id];
    const scope = `[data-fontpreview="${id}"] * { font-family: "${previewFamily(id)}", system-ui, sans-serif !important; }`;
    return `${faceRule(previewFamily(id), font.sans, font.scale, font.weights?.[0])}\n${scope}`;
  }).join('\n');
}

const previewScope = (choice: FontChoice): FontPreviewScope => ({ dataSet: { fontpreview: choice } });

export function useFontPreviews(): ((choice: FontChoice) => FontPreviewScope) | null {
  useEffect(addPreviews, []);
  return previewScope;
}
