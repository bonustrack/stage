import type { ReactNode } from 'react';
import { useWindowDimensions } from 'react-native';
import { Scroll } from '@stage-labs/kit/react-native/scroll';
import { Title } from '@stage-labs/kit/react-native/title';
import { Text } from '@stage-labs/kit/react-native/text';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Col } from '../layout';
import { usePalette } from '../../lib/theme';

const CARD_MAX_WIDTH = 440;
export const BANNER_HEIGHT = 100;
export const BANNER_AVATAR_SIZE = 88;
const CARD_BREAKPOINT = 700;
const CARD_RADIUS = 12;
const HEADER_HEIGHT = 66;

export function useCardLayout(): boolean {
  return useWindowDimensions().width >= CARD_BREAKPOINT;
}

function CardBanner({ banner, background }: { banner: ReactNode; background: string }): React.ReactElement | null {
  if (banner === undefined) return null;
  return (
    <Col background={background} height={BANNER_HEIGHT} align="center" style={{ zIndex: 1 }}>
      <Col align="center" style={{ position: 'absolute', bottom: -BANNER_AVATAR_SIZE / 2 }}>{banner}</Col>
    </Col>
  );
}

export function OnboardingCard({ title, banner, footer, after, children }: {
  title: string; banner?: ReactNode; footer?: ReactNode; after?: ReactNode; children: ReactNode;
}): React.ReactElement {
  const pal = usePalette();
  const card = useCardLayout();
  const inset = card ? 24 : 20;
  const divider = { width: 1, color: pal.border };
  return (
    <Col width="100%" maxWidth={CARD_MAX_WIDTH} align="center" gap={8} style={card ? null : { flex: 1 }}>
      <Col
        width="100%"
        style={[{ borderRadius: CARD_RADIUS, borderWidth: 1, borderColor: pal.border, overflow: 'hidden' }, card ? null : { flex: 1 }]}
      >
        <Col align="center" justify="center" height={HEADER_HEIGHT} padding={{ x: inset }} border={{ bottom: divider }}>
          <Title level={3} color={pal.link} style={{ textAlign: 'center' }}>{title}</Title>
        </Col>
        <CardBanner banner={banner} background={pal.border} />
        <Scroll
          style={card ? undefined : { flex: 1 }}
          contentContainerStyle={{ padding: inset, paddingTop: banner === undefined ? inset : inset + BANNER_AVATAR_SIZE / 2, gap: 16 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </Scroll>
        {footer === undefined || footer === null ? null : (
          <Col gap={10} padding={{ x: inset, y: 16 }} border={{ top: divider }}>{footer}</Col>
        )}
      </Col>
      {after}
    </Col>
  );
}

export function SkipLink({ label = 'Skip for now', disabled, onPress }: {
  label?: string; disabled?: boolean; onPress: () => void;
}): React.ReactElement {
  return (
    <Pressable onPress={onPress} disabled={disabled} hitSlop={8} style={{ alignSelf: 'center', paddingVertical: 8, opacity: disabled === true ? 0.5 : 1 }}>
      <Text value={label} size="lg" color="link" weight="semibold" />
    </Pressable>
  );
}
