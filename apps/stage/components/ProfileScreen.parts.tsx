
import { useEffect, useState } from 'react';
import { Button } from '@stage-labs/kit/react-native/button';
import { Icon } from '@stage-labs/kit/react-native/icon';
import { Text } from '@stage-labs/kit/react-native/text';
import type { HeroIconName } from '@stage-labs/kit/icons';
import { Col, Row } from './layout';
import { usePalette, type Palette } from '../lib/theme';
import { cachedSelfEthAddress, selfEthAddress } from '../modules/messaging';
import { capabilities } from '../lib/capabilities';
import { OverlayHeader } from './chrome/OverlayHeader';
import { TopnavIdentity } from './TopnavIdentity';

export type ProfileColors = Palette;

export function useProfileColors(): ProfileColors {
  return usePalette();
}

export function useSelfAddress(): string {
  const [self, setSelf] = useState(cachedSelfEthAddress() ?? '');
  useEffect(() => {
    if (self) return;
    let alive = true;
    void (async (): Promise<void> => {
      try {
        const address = await selfEthAddress();
        if (alive && address !== null) setSelf(address);
      } catch { }
    })();
    return () => { alive = false; };
  }, [self]);
  return self;
}

export function ProfileHeader({ variant, insetTop, c }: {
  variant: 'tab' | 'route'; insetTop: number;
  c: ProfileColors;
}): React.ReactElement {
  if (variant === 'route') {
    return (
      <OverlayHeader
        onBack={() => { capabilities.back(); }}
        backColor={c.link}
        safeTop={insetTop}
      />
    );
  }
  return (
    <Row
      align="center"
      justify="between"
      height={44 + insetTop}
      padding={{ top: insetTop, x: 14 }}
      style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 2 }}
>
      <TopnavIdentity/>
    </Row>
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
        iconStart={<Icon name={icon} size={22} color={fg} dark={dark} />}
        onPress={onPress}
      />
      <Text value={label} weight="semibold" size="md" color={fg} truncate />
    </Col>
  );
}

export function ProfileActions({ dark, opening, onMessage, onSend, c }: {
  dark: boolean; opening: boolean; onMessage: () => void; onSend: () => void; c: ProfileColors;
}): React.ReactElement {
  return (
    <Row gap={12} justify="start" padding={{ top: 18 }}>
      <ProfileRoundAction
        icon="chatRect"
        label={opening ? 'Opening…' : 'Message'}
        disabled={opening}
        border={c.border}
        fg={c.link}
        dark={dark}
        onPress={() => { if (!opening) onMessage(); }}
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
