/** System menu — a settings-style list with two rows (Kit, About), each pushing
 *  its own sub-page (/system/kit, /system/about). Reached from the LeftDrawer's
 *  "System" row → /system. */

import { Pressable } from 'react-native';
import { ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Box } from '../layout';
import { Icon, type HeroIconName } from '@metro-labs/kit/icon';
import { Text } from '@metro-labs/kit/text';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { SystemHeader } from './SystemHeader';

type Href = '/system/kit' | '/system/about' | '/call/test';
const ROWS: { href: Href; label: string; icon: HeroIconName }[] = [
  { href: '/system/kit', label: 'Kit', icon: 'cog' },
  { href: '/system/about', label: 'About', icon: 'document' },
  { href: '/call/test', label: 'Call test', icon: 'camera' },
];

export function SystemScreen(): React.ReactElement {
  const router = useRouter();
  const dark = useEffectiveColorScheme() === 'dark';
  const { fg, head, bg, border } = usePalette();
  const insets = useSafeAreaInsets();
  const divider = dark ? '#282a2d' : '#e4e4e5';

  return (
    <Box style={{ flex: 1, backgroundColor: bg, paddingTop: insets.top }}>
      <SystemHeader title="System" dark={dark} fg={fg} head={head} border={border} />
      <ScrollView contentContainerStyle={{ paddingBottom: 32 + insets.bottom }}>
        {ROWS.map((row) => (
          <Pressable
            key={row.href}
            onPress={() => router.push(row.href)}
            style={({ pressed }) => ({
              backgroundColor: pressed ? divider : 'transparent',
            })}
          >
            <Box
              style={{
                marginHorizontal: 16,
                paddingVertical: 16,
                flexDirection: 'row', alignItems: 'center', gap: 12,
                borderBottomWidth: 1, borderBottomColor: divider,
              }}
            >
              <Icon name={row.icon} size={22} color={head} />
              <Text style={{ color: head, fontSize: 18, fontFamily: 'Calibre-Medium' }}>{row.label}</Text>
            </Box>
          </Pressable>
        ))}
      </ScrollView>
    </Box>
  );
}
