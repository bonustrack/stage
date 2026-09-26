import { Button } from '@stage-labs/kit/react-native/button';
import { Caption } from '@stage-labs/kit/react-native/caption';
import { Glyph, type CentralIcon } from '@stage-labs/kit/react-native/glyph';
import { useKitScheme } from '@stage-labs/kit/react-native/theme-context';
import { readableForeground, resolveColorToken } from '@stage-labs/kit/tokens';
import { APP_ICONS, type AppIconName } from './appIcons';
import { Col } from './layout';

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

export function WalletActionButton({ label, icon, bg, onPress }: {
  label: string;
  icon: CentralIcon;
  bg: string;
  onPress: () => void;
}): React.ReactElement {
  const scheme = useKitScheme();
  const dark = scheme === 'dark';
  const tintBg = resolveColorToken(bg, scheme);
  return (
    <Col gap={6} align="center">
      <Button
        uniform
        pill
        size="xl"
        color="primary"
        variant="solid"
        tintBg={tintBg}
        tintFg={readableForeground(tintBg)}
        dark={dark}
        iconStart={<Glyph icon={icon} size={24} dark={dark} />}
        onPress={onPress}
      />
      <Caption value={label} weight="semibold" />
    </Col>
  );
}
