/** Presentational pieces of the shared ProfileScreen (see ProfileScreen.tsx).
 *  Split out purely to keep each file under the 200-line lint cap; these have no
 *  state of their own beyond what the parent passes down. */

import { Modal, Pressable, Text, View } from 'react-native';
import { useEffectiveColorScheme } from '../lib/theme';
import { HeroIcon } from './HeroIcon';

export interface ProfileColors {
  fg: string; head: string; sub: string; bg: string; border: string; rowBg: string;
}

export function useProfileColors(): ProfileColors {
  const dark = useEffectiveColorScheme() === 'dark';
  return {
    fg: dark ? '#9f9fa3' : '#57606a',
    head: dark ? '#ffffff' : '#000000',
    sub: dark ? '#7a7a7e' : '#8a929d',
    bg: dark ? '#0e0f10' : '#ffffff',
    border: dark ? '#282a2d' : '#e4e4e5',
    rowBg: dark ? '#282a2d' : '#e4e4e5',
  };
}

/** Boxed read-only field with an optional copy affordance. */
export function InfoRow({ label, value, onCopy, c }: {
  label: string; value: string; onCopy?: () => void; c: ProfileColors;
}): React.ReactElement {
  return (
    <View style={{
      marginHorizontal: 16, marginTop: 12, padding: 12,
      borderRadius: 12, backgroundColor: c.rowBg, borderWidth: 1, borderColor: c.border,
      flexDirection: 'row', alignItems: 'center', gap: 8,
    }}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: c.sub, fontSize: 11, fontFamily: 'Calibre-Medium' }}>{label.toUpperCase()}</Text>
        <Text style={{ color: c.fg, fontSize: 14, marginTop: 4, fontFamily: 'Calibre-Medium' }} selectable>{value}</Text>
      </View>
      {onCopy ? (
        <Pressable onPress={onCopy} hitSlop={8} style={{ padding: 4 }}>
          <HeroIcon name="copy" size={18} color={c.sub} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** Message + Send action pair shown only on OTHER users' profiles. */
export function ProfileActions({ dark, opening, onMessage, onSend, c }: {
  dark: boolean; opening: boolean; onMessage: () => void; onSend: () => void; c: ProfileColors;
}): React.ReactElement {
  return (
    <View style={{ flexDirection: 'row', gap: 10, marginTop: 18, paddingHorizontal: 24, alignSelf: 'stretch' }}>
      <Pressable
        onPress={onMessage}
        disabled={opening}
        style={({ pressed }) => ({
          flex: 1, paddingVertical: 12, alignItems: 'center',
          borderRadius: 999, backgroundColor: dark ? '#ffffff' : '#000000',
          opacity: pressed ? 0.85 : opening ? 0.6 : 1,
        })}
      >
        <Text style={{ color: dark ? '#000000' : '#ffffff', fontSize: 15, fontFamily: 'Calibre-Semibold' }}>
          {opening ? 'Opening…' : 'Message'}
        </Text>
      </Pressable>
      <Pressable
        onPress={onSend}
        style={({ pressed }) => ({
          flex: 1, paddingVertical: 12, alignItems: 'center',
          borderRadius: 999, backgroundColor: pressed ? c.border : c.rowBg,
          borderWidth: 1, borderColor: c.border,
        })}
      >
        <Text style={{ color: c.head, fontSize: 15, fontFamily: 'Calibre-Semibold' }}>Send</Text>
      </Pressable>
    </View>
  );
}

/** Own-profile overflow menu — backdrop-dismiss sheet pinned top-right under the
 *  header, with a single "Edit profile" action. */
export function EditMenu({ visible, top, onClose, onEdit, c }: {
  visible: boolean; top: number; onClose: () => void; onEdit: () => void; c: ProfileColors;
}): React.ReactElement {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={{ flex: 1 }} onPress={onClose}>
        <View style={{
          position: 'absolute', right: 12, top,
          minWidth: 168, borderRadius: 12, overflow: 'hidden',
          backgroundColor: c.bg, borderWidth: 1, borderColor: c.border,
        }}>
          <Pressable
            onPress={onEdit}
            style={({ pressed }) => ({
              flexDirection: 'row', alignItems: 'center', gap: 10,
              paddingHorizontal: 14, paddingVertical: 12,
              backgroundColor: pressed ? c.rowBg : 'transparent',
            })}
          >
            <HeroIcon name="pencil" size={18} color={c.head} />
            <Text style={{ color: c.head, fontSize: 15, fontFamily: 'Calibre-Medium' }}>Edit profile</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}
