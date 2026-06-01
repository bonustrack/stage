/** System screen body — back-arrow header + Kit | About underline tabs, with a
 *  Kit component gallery and an About (version / commit) panel. Reached from the
 *  LeftDrawer's "System" row → /system. */

import { useState } from 'react';
import { Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Box } from '../layout';
import { Icon } from '@metro-labs/kit/icon';
import { Title } from '@metro-labs/kit/title';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { SystemTabs, type SystemTab } from './SystemTabs';
import { KitGallery } from './KitGallery';
import { AboutPanel } from './AboutPanel';

export function SystemScreen(): React.ReactElement {
  const router = useRouter();
  const dark = useEffectiveColorScheme() === 'dark';
  const { fg, head, sub, bg, border, rowBg } = usePalette();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<SystemTab>('kit');

  return (
    <Box style={{ flex: 1, backgroundColor: bg, paddingTop: insets.top }}>
      {/* Topnav: back + title, mirroring the Accounts page. */}
      <Box style={{
        flexDirection: 'row', alignItems: 'center', gap: 8,
        paddingHorizontal: 12, paddingTop: 8, paddingBottom: 10,
        borderBottomWidth: 1, borderBottomColor: border,
      }}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={{ padding: 4 }}>
          <Icon name="arrowLeft" size={22} color={fg} />
        </Pressable>
        <Title dark={dark} style={{ color: head, fontSize: 20 }}>System</Title>
      </Box>

      <SystemTabs tab={tab} setTab={setTab} head={head} sub={sub} border={border} />

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 32 + insets.bottom }}
      >
        {tab === 'kit' ? (
          <KitGallery dark={dark} head={head} sub={sub} border={border} rowBg={rowBg} />
        ) : (
          <AboutPanel dark={dark} head={head} sub={sub} border={border} />
        )}
      </ScrollView>
    </Box>
  );
}
