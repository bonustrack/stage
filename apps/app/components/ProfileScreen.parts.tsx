/** Presentational pieces of the shared ProfileScreen (see ProfileScreen.tsx).
 *  Split out purely to keep each file under the 200-line lint cap; these have no
 *  state of their own beyond what the parent passes down. */

import { useEffect, useState } from 'react';

import { Modal } from 'react-native';
import { Pressable } from '@metro-labs/kit/pressable';
import { Text } from '@metro-labs/kit/text';
import { Box } from './layout';
import { usePalette, useBlockRadius, type Palette } from '../lib/theme';
import { getCachedXmtpClient, getOrCreateXmtpClient } from '../modules/messaging';
import { Icon, type HeroIconName } from '@metro-labs/kit/icon';
import { Button } from '@metro-labs/kit/button';
import { TopnavIdentity } from './TopnavIdentity';

export type ProfileColors = Palette;

export function useProfileColors(): ProfileColors {
  return usePalette();
}

/** Resolve the active account's address: cached client first (synchronous, so
 *  own-vs-other settles on first paint when the client is already up), then a
 *  best-effort async fetch on cold start. */
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

/** Top header bar — variant-specific. Both expose the own-profile overflow
 *  menu (edit) on the right; the route variant adds a back button on the left.
 *  For `route` the header is absolutely positioned so it floats over the
 *  full-bleed cover; for `tab` it stays an in-flow opaque strip. */
export function ProfileHeader({ variant, insetTop, isSelf, onBack, onMenu, c }: {
  variant: 'tab' | 'route'; insetTop: number; isSelf: boolean;
  onBack: () => void; onMenu: () => void; c: ProfileColors;
}): React.ReactElement {
  return (
    <Box style={{
      ...(variant === 'route'
        ? {
          position: 'absolute', top: 0, left: 0, right: 0, zIndex: 2,
          height: 44 + insetTop, paddingTop: insetTop, paddingHorizontal: 14,
        }
        : { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, backgroundColor: c.toolbarBg }),
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    }}>
      {variant === 'route' ? (
        <Pressable onPress={onBack} hitSlop={10} style={{ padding: 6 }}>
          <Icon name="arrowLeft" size={22} color={c.link} />
        </Pressable>
      ) : (
        // Tab variant: avatar + name → Menu, matching the Home topnav identity.
        <TopnavIdentity />
      )}
      {isSelf ? (
        <Pressable onPress={onMenu} hitSlop={8} style={{ padding: 6 }}>
          <Icon name="dotsHorizontal" size={22} color={c.link} />
        </Pressable>
      ) : null}
    </Box>
  );
}

/** Boxed read-only field with an optional copy affordance. */
export function InfoRow({ label, value, onCopy, c }: {
  label: string; value: string; onCopy?: () => void; c: ProfileColors;
}): React.ReactElement {
  const blockRadius = useBlockRadius();
  return (
    <Box style={{
      marginHorizontal: 16, marginTop: 12, padding: 12,
      borderRadius: blockRadius, backgroundColor: c.border, borderWidth: 1, borderColor: c.border,
      flexDirection: 'row', alignItems: 'center', gap: 8,
    }}>
      <Box style={{ flex: 1 }}>
        <Text size="xs" style={{ color: c.text }}>{label.toUpperCase()}</Text>
        <Text size="md" style={{ color: c.text, marginTop: 4 }} selectable>{value}</Text>
      </Box>
      {onCopy ? (
        <Pressable onPress={onCopy} hitSlop={8} style={{ padding: 4 }}>
          <Icon name="copy" size={18} color={c.text} />
        </Pressable>
      ) : null}
    </Box>
  );
}

/** Message + Send action pair shown only on OTHER users' profiles.
 *  Kit `pill` icon-only Buttons (secondary variant, `size="xl"`) rendering a
 *  56×56 circle, each with the text label as a separate <Text> BELOW the circle.
 *  LEFT-aligned in a single row — matches the wallet tab's action buttons. */
export function ProfileActions({ dark, opening, onMessage, onSend, c }: {
  dark: boolean; opening: boolean; onMessage: () => void; onSend: () => void; c: ProfileColors;
}): React.ReactElement {
  const Btn = ({ icon, label, onPress, disabled }: {
    icon: HeroIconName; label: string; onPress: () => void; disabled?: boolean;
  }): React.ReactElement => (
    <Box style={{ alignItems: 'center', gap: 6 }}>
      <Button
        variant="secondary"
        size="xl"
        pill
        dark={dark}
        onPress={onPress}
        disabled={disabled}
        icon={<Icon name={icon} size={22} color={c.link} />}
        // Override the kit's static secondary fill with the live `border` palette
        // token so the circle reacts to theme/colour overrides like the rest of
        // the design system (ChannelRow rowBg = border).
        style={{ backgroundColor: c.border, borderColor: c.border }}
      />
      <Text weight="semibold" size="md" style={{ color: c.link }} numberOfLines={1}>{label}</Text>
    </Box>
  );
  return (
    <Box style={{ flexDirection: 'row', gap: 12, marginTop: 18, justifyContent: 'flex-start' }}>
      <Btn icon="chatRect" label={opening ? 'Opening…' : 'Message'} onPress={onMessage} disabled={opening} />
      <Btn icon="send" label="Send" onPress={onSend} />
    </Box>
  );
}

/** Own-profile overflow menu — backdrop-dismiss sheet pinned top-right under the
 *  header, with a single "Edit profile" action. */
export function EditMenu({ visible, top, onClose, onEdit, c }: {
  visible: boolean; top: number; onClose: () => void; onEdit: () => void; c: ProfileColors;
}): React.ReactElement {
  const blockRadius = useBlockRadius();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={{ flex: 1 }} onPress={onClose}>
        <Box style={{
          position: 'absolute', right: 12, top,
          minWidth: 168, borderRadius: blockRadius, overflow: 'hidden',
          backgroundColor: c.bg, borderWidth: 1, borderColor: c.border,
        }}>
          <Pressable
            onPress={onEdit}
            style={({ pressed }) => ({
              flexDirection: 'row', alignItems: 'center', gap: 10,
              paddingHorizontal: 14, paddingVertical: 12,
              backgroundColor: pressed ? c.border : 'transparent',
            })}
          >
            <Icon name="pencil" size={18} color={c.link} />
            <Text size="md" style={{ color: c.link }}>Edit profile</Text>
          </Pressable>
        </Box>
      </Pressable>
    </Modal>
  );
}
