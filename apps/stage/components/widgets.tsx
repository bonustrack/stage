import { Glyph, type CentralIcon } from '@stage-labs/kit/react-native/glyph';
import { useKitScheme } from '@stage-labs/kit/react-native/theme-context';
import { resolveColorToken } from '@stage-labs/kit/tokens';
import { APP_ICONS, type AppIconName } from './appIcons';

export type AppIconRef = AppIconName | CentralIcon;

export function appIcon(ref: AppIconRef): CentralIcon {
  return typeof ref === 'string' ? APP_ICONS[ref] : ref;
}

export function AppIcon({ name, color, size }: {
  name: AppIconRef;
  color?: string;
  size: number;
}): React.ReactElement {
  const scheme = useKitScheme();
  return (
    <Glyph
      icon={appIcon(name)}
      size={size}
      color={color === undefined ? undefined : resolveColorToken(color, scheme)}
      dark={scheme === 'dark'}
    />
  );
}
