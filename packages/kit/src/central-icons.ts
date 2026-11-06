import { KIT_ICON_ALIASES, type KitIconAliasName, type KitIconAliasTarget } from './central-icons.aliases';
import { CENTRAL_ICONS } from './central-icons.named.data';
import type { CentralIcon, IconStyle } from './glyph';
import type { HERO_ICON_DATA } from './heroicons.data';

export type { KitIconAliasName };

export type IconName = keyof typeof HERO_ICON_DATA | CentralIcon;

interface IconPair {
  line: CentralIcon;
  solid?: CentralIcon;
}

function aliasPair(target: KitIconAliasTarget): IconPair {
  if (typeof target === 'string') return CENTRAL_ICONS[target];
  const entry = CENTRAL_ICONS[target.name];
  return { line: target.style === 'solid' ? (entry.solid ?? entry.line) : entry.line };
}

export const CENTRAL_ICON_ALIASES = Object.fromEntries(
  Object.entries(KIT_ICON_ALIASES).map(([alias, target]) => [alias, aliasPair(target)]),
) as Record<KitIconAliasName, IconPair>;

export function isKitIconAliasName(name: string): name is KitIconAliasName {
  return Object.hasOwn(KIT_ICON_ALIASES, name);
}

export function centralIcon(name: IconName | KitIconAliasName, style: IconStyle = 'line'): CentralIcon {
  if (typeof name !== 'string') return name;
  const alias = CENTRAL_ICON_ALIASES[name];
  return style === 'solid' ? (alias.solid ?? alias.line) : alias.line;
}
