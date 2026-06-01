/** System menu — a settings-style list with two rows (Kit, About), each pushing
 *  its own sub-page (/system/kit, /system/about). Reached from the LeftDrawer's
 *  "System" row → /system. */

import { Pressable } from 'react-native';
import { ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Box, Col } from '../layout';
import { Icon, type HeroIconName } from '@metro-labs/kit/icon';
import { Text } from '@metro-labs/kit/text';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { SystemHeader } from './SystemHeader';

type Href = '/system/kit' | '/system/about';
const ROWS: { href: Href; label: string; sub: string; icon: HeroIconName }[] = [
  { href: '/system/kit', label: 'Kit', sub: 'Component gallery', icon: 'cog' },
  { href: '/system/about', label: 'About', sub: 'Version & build info', icon: 'document' },
];

export function SystemScreen(): React.ReactElement {
  const router = useRouter();
  const dark = useEffectiveColorScheme() === 'dark';
  const { fg, head, sub, bg, border, rowBg } = usePalette();
  const insets = useSafeAreaInsets();

  return (
    <Box style={{ flex: 1, backgroundColor: bg, paddingTop: insets.top }}>
      <SystemHeader title="System" dark={dark} fg={fg} head={head} border={border} />
      <ScrollView contentContainerStyle={{ paddingBottom: 32 + insets.bottom }}>
        <Col mx={16} mt={16} radius={12} bg={rowBg} style={{
          overflow: 'hidden', borderWidth: 1, borderColor: border,
        }}>
          {ROWS.map((row, i) => (
            <Pressable
              key={row.href}
              onPress={() => router.push(row.href)}
              style={({ pressed }) => ({
                paddingHorizontal: 14, paddingVertical: 14,
                flexDirection: 'row', alignItems: 'center', gap: 12,
                borderTopWidth: i === 0 ? 0 : 1, borderTopColor: border,
                backgroundColor: pressed ? border : 'transparent',
              })}
            >
              <Icon name={row.icon} size={22} color={head} />
              <Col flex={1}>
                <Text style={{ color: fg, fontSize: 18, fontFamily: 'Calibre-Medium' }}>{row.label}</Text>
                <Text style={{ color: sub, fontSize: 13, marginTop: 2, fontFamily: 'Calibre-Medium' }}>
                  {row.sub}
                </Text>
              </Col>
            </Pressable>
          ))}
        </Col>
      </ScrollView>
    </Box>
  );
}
