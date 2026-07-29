
import { resolveIconName } from '@stage-labs/kit/icons';
import { Button } from '@stage-labs/kit/react-native/button';
import { Caption } from '@stage-labs/kit/react-native/caption';
import { Icon } from '@stage-labs/kit/react-native/icon';
import { useKitScheme } from '@stage-labs/kit/react-native/theme-context';
import { readableForeground, resolveColorToken } from '@stage-labs/kit/tokens';
import { Col } from './layout';

export function AppIcon({ name, color, size }: {
  name: string;
  color?: string;
  size: number;
}): React.ReactElement | null {
  const scheme = useKitScheme();
  const resolved = resolveIconName(name);
  if (resolved === undefined) return null;
  return (
    <Icon
      name={resolved}
      size={size}
      color={color === undefined ? undefined : resolveColorToken(color, scheme)}
      dark={scheme === 'dark'}
    />
  );
}

export function WalletActionButton({ label, icon, bg, onPress }: {
  label: string;
  icon: string;
  bg: string;
  onPress: () => void;
}): React.ReactElement {
  const scheme = useKitScheme();
  const dark = scheme === 'dark';
  const tintBg = resolveColorToken(bg, scheme);
  const iconName = resolveIconName(icon);
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
        iconStart={iconName === undefined ? undefined : <Icon name={iconName} size={22} dark={dark} />}
        onPress={onPress}
      />
      <Caption value={label} weight="semibold" />
    </Col>
  );
}
