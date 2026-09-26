import { CENTRAL_ICON_ALIASES } from './central-icons.data';
import type { CentralIcon, IconStyle } from './glyph';
import type { HERO_ICON_DATA } from './heroicons.data';

export { CENTRAL_ICON_ALIASES };

export type IconName = keyof typeof HERO_ICON_DATA | CentralIcon;

export function centralIcon(name: IconName, style: IconStyle = 'line'): CentralIcon {
  if (typeof name !== 'string') return name;
  const alias = CENTRAL_ICON_ALIASES[name];
  return style === 'solid' ? alias.solid ?? alias.line : alias.line;
}
