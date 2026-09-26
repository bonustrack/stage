
import { useQuery } from '@tanstack/react-query';
import { Button } from '@stage-labs/kit/react-native/button';
import { Glyph, type CentralIcon } from '@stage-labs/kit/react-native/glyph';
import { Text } from '@stage-labs/kit/react-native/text';
import { Col, Row } from './layout';
import type { Palette } from '../lib/theme';
import { cachedSelfEthAddress, selfEthAddress } from '../modules/messaging';
import { IconBubbleDots } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconBubbleDots';
import { IconPaperPlane } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconPaperPlane';

export function useSelfAddress(): string {
  const { data } = useQuery({
    queryKey: ['selfEthAddress'],
    queryFn: async (): Promise<string> => (await selfEthAddress()) ?? '',
    initialData: () => cachedSelfEthAddress() ?? undefined,
    staleTime: Infinity,
  });
  return data ?? '';
}

function ProfileRoundAction({ icon, label, disabled, border, fg, dark, onPress }: {
  icon: CentralIcon; label: string; disabled?: boolean;
  border: string; fg: string; dark: boolean; onPress: () => void;
}): React.ReactElement {
  return (
    <Col align="center" gap={6}>
      <Button
        color="primary"
        variant="solid"
        size="xl"
        pill
        uniform
        tintBg={border}
        tintFg={fg}
        disabled={disabled}
        dark={dark}
        iconStart={<Glyph icon={icon} size={24} color={fg} dark={dark} />}
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
        icon={IconBubbleDots}
        label="Message"
        border={c.border}
        fg={c.link}
        dark={dark}
        onPress={onMessage}
      />
      <ProfileRoundAction
        icon={IconPaperPlane}
        label="Send"
        border={c.border}
        fg={c.link}
        dark={dark}
        onPress={onSend}
      />
    </Row>
  );
}
