import { Button } from '@stage-labs/kit/react-native/button';
import { Glyph, type CentralIcon } from '@stage-labs/kit/react-native/glyph';
import { Text } from '@stage-labs/kit/react-native/text';
import type { Palette } from '../../lib/theme';
import { appIcon } from '../widgets';
import { PEER_PROFILE_ACTIONS, type PeerAction } from './ProfileScreen.model';
import { Column, Row } from '../layout';

function ProfileRoundAction({
  icon,
  label,
  border,
  fg,
  dark,
  onPress,
}: {
  icon: CentralIcon;
  label: string;
  border: string;
  fg: string;
  dark: boolean;
  onPress: () => void;
}): React.ReactElement {
  return (
    <Column align="center" gap={6}>
      <Button
        color="primary"
        variant="solid"
        size="xl"
        pill
        uniform
        tintBg={border}
        tintFg={fg}
        dark={dark}
        iconStart={<Glyph icon={icon} size={24} color={fg} dark={dark} />}
        onPress={onPress}
      />
      <Text text={label} fontWeight="semibold" size="xs" color={fg} truncate />
    </Column>
  );
}

export function ProfileActions({
  dark,
  onMessage,
  onSend,
  c,
}: {
  dark: boolean;
  onMessage: () => void;
  onSend: () => void;
  c: Palette;
}): React.ReactElement {
  const press: Record<PeerAction, () => void> = { message: onMessage, send: onSend };
  return (
    <Row gap={12} justify="start" padding={{ top: 18 }}>
      {PEER_PROFILE_ACTIONS.map((item) => (
        <ProfileRoundAction
          key={item.id}
          icon={appIcon(item.icon)}
          label={item.label}
          onPress={press[item.id]}
          border={c.border}
          fg={c.link}
          dark={dark}
        />
      ))}
    </Row>
  );
}
