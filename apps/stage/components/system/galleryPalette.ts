import { useEffectiveColorScheme, usePalette } from '../../lib/theme';

export interface GalleryPalette {
  dark: boolean;
  head: string;
  sub: string;
  border: string;
  rowBg: string;
}

export function useGalleryPalette(): GalleryPalette {
  const dark = useEffectiveColorScheme() === 'dark';
  const { text, link, border } = usePalette();
  return { dark, head: link, sub: text, border, rowBg: border };
}
