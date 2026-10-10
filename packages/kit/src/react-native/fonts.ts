import calibreMedium from '../fonts/Calibre-Medium-Custom.ttf';
import calibreSemibold from '../fonts/Calibre-Semibold-Custom.ttf';
import { fontName } from '../tokens';

export const KIT_FONTS: Record<string, string | number> = {
  [fontName.sans]: calibreMedium,
  [fontName.head]: calibreSemibold,
};
