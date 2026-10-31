import { createValueStore } from './persistedStore';

export const FONT_CHOICES = [
  { id: 'calibre', label: 'Calibre' },
  { id: 'airbnb', label: 'Airbnb Cereal' },
  { id: 'claude', label: 'Anthropic Sans' },
  { id: 'dropbox', label: 'Atlas Grotesk' },
  { id: 'databricks', label: 'DM Sans' },
  { id: 'mobbin', label: 'Mobbin Saans' },
  { id: 'chatgpt', label: 'OpenAI Sans' },
  { id: 'intercom', label: 'Saans' },
  { id: 'apple', label: 'SF Pro' },
  { id: 'stripe', label: 'Söhne' },
  { id: 'spotify', label: 'Spotify Mix' },
  { id: 'tiktok', label: 'TikTok Sans' },
] as const;

export type FontChoice = (typeof FONT_CHOICES)[number]['id'];

export interface FontPreviewScope {
  dataSet: { fontpreview: FontChoice };
}

export const DEFAULT_FONT: FontChoice = 'calibre';

const isFontChoice = (raw: string): raw is FontChoice => FONT_CHOICES.some((choice) => choice.id === raw);

export const fontChoice = createValueStore<FontChoice>({
  key: 'theme:font',
  default: DEFAULT_FONT,
  deserialize: (raw) => (isFontChoice(raw) ? raw : undefined),
});

export const useFontChoice = (): FontChoice => fontChoice.use();

export function setFontChoice(choice: FontChoice): void {
  fontChoice.set(choice);
}
