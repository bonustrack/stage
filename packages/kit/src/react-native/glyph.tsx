import { iconStroke, type CentralIcon, type IconStyle } from '../glyph';

export type { CentralIcon, IconStyle };

export interface GlyphProps {
  icon: CentralIcon;
  size?: number;
  color?: string;
  dark?: boolean;
}

const RAW_MODE = { mode: 'raw' } as const;

export function Glyph({ icon: Central, size = 22, color, dark }: GlyphProps): React.ReactElement {
  const stroke = iconStroke(color, dark);
  return <Central {...RAW_MODE} size={size} color={stroke === 'currentColor' ? undefined : stroke} />;
}
