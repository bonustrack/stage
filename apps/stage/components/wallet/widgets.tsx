
import { resolveBadgeStyle } from '@stage-labs/kit/badge';
import { resolveIconName } from '@stage-labs/kit/icons';
import { Button } from '@stage-labs/kit/react-native/button';
import { Caption } from '@stage-labs/kit/react-native/caption';
import { Icon } from '@stage-labs/kit/react-native/icon';
import { Text } from '@stage-labs/kit/react-native/text';
import { useKitScheme } from '@stage-labs/kit/react-native/theme-context';
import { readableForeground, resolveColorToken } from '@stage-labs/kit/tokens';
import { Box, Col } from '../layout';

export function WalletIcon({ name, color, size }: {
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

export function SoftBadge({ label, color }: {
  label: string;
  color: 'success' | 'danger' | 'secondary';
}): React.ReactElement {
  const scheme = useKitScheme();
  const styled = resolveBadgeStyle(color, undefined, 'sm', scheme);
  return (
    <Box
      direction="row"
      align="center"
      padding={{ x: 8, y: 2 }}
      radius="sm"
      background={styled.background}
    >
      <Text value={label} size={styled.fontToken} weight="semibold" color={styled.foreground} />
    </Box>
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
        iconStart={iconName === undefined ? undefined : <Icon name={iconName} size={18} dark={dark} />}
        onPress={onPress}
      />
      <Caption value={label} weight="semibold" />
    </Col>
  );
}
