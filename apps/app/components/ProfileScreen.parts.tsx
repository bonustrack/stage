
import { useEffect, useState } from 'react';
import { Pressable } from '@stage-labs/kit/pressable';
import { Text } from '@stage-labs/kit/text';
import { Box, Row } from './layout';
import { usePalette, type Palette } from '../lib/theme';
import { getCachedXmtpClient, getOrCreateXmtpClient } from '../modules/messaging';
import { Icon, type HeroIconName } from '@stage-labs/kit/icon';
import { Button } from '@stage-labs/kit/button';
import { TopnavIdentity } from './TopnavIdentity';

export type ProfileColors = Palette;

export function useProfileColors(): ProfileColors {
  return usePalette();
}

export function useSelfAddress(): string {
  const cached = getCachedXmtpClient();
  const [self, setSelf] = useState(cached?.publicIdentity.identifier ?? '');
  useEffect(() => {
    if (self) return;
    let alive = true;
    void (async (): Promise<void> => {
      try {
        const client = await getOrCreateXmtpClient('production');
        if (alive) setSelf(client.publicIdentity.identifier);
      } catch { }
    })();
    return () => { alive = false; };
  }, [self]);
  return self;
}

export function ProfileHeader({ variant, insetTop, onBack, c }: {
  variant: 'tab' | 'route'; insetTop: number;
  onBack: () => void; c: ProfileColors;
}): React.ReactElement {
  const headerStyle = {
    position: 'absolute' as const, top: 0, left: 0, right: 0, zIndex: 2,
    height: 44 + insetTop, paddingTop: insetTop, paddingHorizontal: 14,
  };
  return (
    <Row
      align="center"
      justify="between"
      style={headerStyle}
>
      {variant === 'route' ? (
        <Pressable onPress={onBack} hitSlop={10} style={{ padding: 6 }}>
          <Icon name="arrowLeft" size={22} color={c.link}/>
        </Pressable>
      ) : (
        <TopnavIdentity/>
      )}
    </Row>
  );
}

export function ProfileActions({ dark, opening, onMessage, onSend, c }: {
  dark: boolean; opening: boolean; onMessage: () => void; onSend: () => void; c: ProfileColors;
}): React.ReactElement {
  const Btn = ({ icon, label, onPress, disabled }: {
    icon: HeroIconName; label: string; onPress: () => void; disabled?: boolean;
  }): React.ReactElement => (
    <Box align="center" gap={6}>
      <Button
        variant="secondary"
        size="xl"
        pill
        dark={dark}
        onPress={onPress}
        disabled={disabled}
        icon={<Icon name={icon} size={22} color={c.link} />}
        style={{ backgroundColor: c.border, borderColor: c.border }}
/>
      <Text weight="semibold" size="md" color={c.link} numberOfLines={1}>{label}</Text>
    </Box>
  );
  return (
    <Row margin={{ top: 18 }} gap={12} justify="start">
      <Btn icon="chatRect" label={opening ? 'Opening…' : 'Message'} onPress={onMessage} disabled={opening}/>
      <Btn icon="send" label="Send" onPress={onSend}/>
    </Row>
  );
}
