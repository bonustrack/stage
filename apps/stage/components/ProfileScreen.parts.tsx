
import { useQuery } from '@tanstack/react-query';
import { Button } from '@stage-labs/kit/react-native/button';
import { Icon } from '@stage-labs/kit/react-native/icon';
import { Text } from '@stage-labs/kit/react-native/text';
import type { HeroIconName } from '@stage-labs/kit/icons';
import { Col, Row } from './layout';
import type { Palette } from '../lib/theme';
import { cachedSelfEthAddress, selfEthAddress } from '../modules/messaging';
import { capabilities } from '../lib/capabilities';
import { OverlayHeader } from './chrome/OverlayHeader';

export function useSelfAddress(): string {
  const { data } = useQuery({
    queryKey: ['selfEthAddress'],
    queryFn: async (): Promise<string> => (await selfEthAddress()) ?? '',
    initialData: () => cachedSelfEthAddress() ?? undefined,
    staleTime: Infinity,
  });
  return data ?? '';
}

export function ProfileHeader({ insetTop, c, menu }: {
  insetTop: number; c: Palette; menu?: React.ReactNode;
}): React.ReactElement {
  return (
    <OverlayHeader
      onBack={() => { capabilities.back(); }}
      backColor={c.link}
      safeTop={insetTop}
      trailing={menu}
    />
  );
}

function ProfileRoundAction({ icon, label, disabled, border, fg, dark, onPress }: {
  icon: HeroIconName; label: string; disabled?: boolean;
  border: string; fg: string; dark: boolean; onPress: () => void;
}): React.ReactElement {
  return (
    <Col align="center" gap={6}>
      <Button
        color="primary"
        variant="solid"
        size="xl"
        pill
        tintBg={border}
        tintFg={fg}
        disabled={disabled}
        dark={dark}
        iconStart={<Icon name={icon} size={24} color={fg} dark={dark} />}
        onPress={onPress}
      />
      <Text value={label} weight="semibold" size="md" color={fg} truncate />
    </Col>
  );
}

export function ProfileActions({ dark, onMessage, onSend, c }: {
  dark: boolean; onMessage: () => void; onSend: () => void; c: Palette;
}): React.ReactElement {
  return (
    <Row gap={12} justify="start" padding={{ top: 18 }}>
      <ProfileRoundAction
        icon="chatRect"
        label="Message"
        border={c.border}
        fg={c.link}
        dark={dark}
        onPress={onMessage}
      />
      <ProfileRoundAction
        icon="send"
        label="Send"
        border={c.border}
        fg={c.link}
        dark={dark}
        onPress={onSend}
      />
    </Row>
  );
}
