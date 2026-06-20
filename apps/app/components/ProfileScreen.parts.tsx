/** @file Presentational pieces and hooks (header, actions, palette/self-address) for the shared ProfileScreen. */

import { useEffect, useState } from 'react';
import { Pressable } from '@metro-labs/kit/pressable';
import { Text } from '@metro-labs/kit/text';
import { Box, Row } from './layout';
import { usePalette, type Palette } from '../lib/theme';
import { getCachedXmtpClient, getOrCreateXmtpClient } from '../modules/messaging';
import { Icon, type HeroIconName } from '@metro-labs/kit/icon';
import { Button } from '@metro-labs/kit/button';
import { TopnavIdentity } from './TopnavIdentity';

export type ProfileColors = Palette;

/** Hook that returns the active palette colors used across profile screen parts. */
export function useProfileColors(): ProfileColors {
  return usePalette();
}

/** Resolve the active account's address: cached client first (synchronous, so own-vs-other settles on first paint when the client is already up), then a best-effort async fetch on cold start. */
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
      } catch { /* leave blank — treat as other until resolved */ }
    })();
    return () => { alive = false; };
  }, [self]);
  return self;
}

/** Variant-specific top header bar: the route variant adds a back button floating over the full-bleed cover, the tab variant shows the Home-style identity; identity is read-only with no edit affordance. */
export function ProfileHeader({ variant, insetTop, onBack, c }: {
  variant: 'tab' | 'route'; insetTop: number;
  onBack: () => void; c: ProfileColors;
}): React.ReactElement {
  /** Absolute floating header over the cover; inset-derived offsets can't be static layout props, so the style is built here and passed as an identifier (the layout-prop lint only flags inline style literals on Box/Row/Col). */
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
        /** Tab variant: avatar + name → Menu, matching the Home topnav identity. */
        <TopnavIdentity/>
      )}
    </Row>
  );
}

/** Message + Send action pair shown only on other users' profiles: kit pill icon-only Buttons rendering a 56x56 circle with a label below, left-aligned in one row to match the wallet tab. */
export function ProfileActions({ dark, opening, onMessage, onSend, c }: {
  dark: boolean; opening: boolean; onMessage: () => void; onSend: () => void; c: ProfileColors;
}): React.ReactElement {
  /** The Btn component. */
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
        /** Override the kit's static secondary fill with the live `border` palette token so the circle reacts to theme/colour overrides like the rest of the design system (ChannelRow rowBg = border). */
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
