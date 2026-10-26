import { useQuery } from '@tanstack/react-query';
import { Button } from '@stage-labs/kit/react-native/button';
import { Glyph, type CentralIcon } from '@stage-labs/kit/react-native/glyph';
import { Text } from '@stage-labs/kit/react-native/text';
import type { Palette } from '../lib/theme';
import { cachedSelfEthAddress, selfEthAddress } from '../lib/xmtp.client';
import { IconBubbleAnnotation3 } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconBubbleAnnotation3';
import { IconPaperPlane } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconPaperPlane';
import { Column, Row } from './layout';

export function useSelfAddress(): string {
  const { data } = useQuery({
    queryKey: ['selfEthAddress'],
    queryFn: async (): Promise<string> => (await selfEthAddress()) ?? '',
    initialData: () => cachedSelfEthAddress() ?? undefined,
    staleTime: Infinity,
  });
  return data ?? '';
}

function ProfileRoundAction({ icon, label, border, fg, dark, onPress }: {
  icon: CentralIcon; label: string;
  border: string; fg: string; dark: boolean; onPress: () => void;
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

export function ProfileActions({ dark, onMessage, onSend, c }: {
  dark: boolean; onMessage: () => void; onSend: () => void; c: Palette;
}): React.ReactElement {
  const actions = [
    { icon: IconBubbleAnnotation3, label: 'Message', onPress: onMessage },
    { icon: IconPaperPlane, label: 'Send', onPress: onSend },
  ];
  return (
    <Row gap={12} justify="start" padding={{ top: 18 }}>
      {actions.map(action => <ProfileRoundAction key={action.label} {...action} border={c.border} fg={c.link} dark={dark} />)}
    </Row>
  );
}
