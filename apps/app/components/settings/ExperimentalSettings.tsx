/** Settings → Experimental menu - a System-page-style list (same Kit ListView
 *  style as the main Settings menu) housing the not-yet-stable surfaces: the Kit
 *  theme/component gallery, the app Components gallery, and the Developer
 *  diagnostics console. Reached via /settings → "Experimental" row. */

import { Scroll as ScrollView } from '@metro-labs/kit/scroll';

import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Col } from '../layout';
import { Icon, type HeroIconName } from '@metro-labs/kit/icon';
import { Text } from '@metro-labs/kit/text';
import { ListView, ListViewItem } from '@metro-labs/kit/list-view';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { setOnboardingSeen } from '../../lib/onboardingSeen';
import { SystemHeader } from '../system/SystemHeader';

type Href = '/settings/kit' | '/settings/components' | '/settings/developer' | '/settings/spike7702';
const ROWS: { href: Href; label: string; icon: HeroIconName }[] = [
  { href: '/settings/kit', label: 'Kit', icon: 'colorSwatch' },
  { href: '/settings/components', label: 'Components', icon: 'viewGrid' },
  { href: '/settings/developer', label: 'Developer', icon: 'beaker' },
  { href: '/settings/spike7702', label: '7702 spike', icon: 'beaker' },
];

export function ExperimentalSettings(): React.ReactElement {
  const router = useRouter();
  const dark = useEffectiveColorScheme() === 'dark';
  const { text: fg, link: head, border } = usePalette();
  const sub = fg;
  const insets = useSafeAreaInsets();

  return (
    <Col surface="surface" flex={1}>
      <SystemHeader title="Experimental" dark={dark} fg={fg} head={head} border={border}/>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 + insets.bottom }}>
        <ListView dark={dark}>
          {ROWS.map((row) => (
            <ListViewItem key={row.href} dark={dark} onPress={() => router.push(row.href)}>
              <Icon name={row.icon} size={22} color={head}/>
              <Col flex={1}>
                <Text size="xl" color={head}>{row.label}</Text>
              </Col>
              <Icon name="chevronRight" size={18} color={sub}/>
            </ListViewItem>
          ))}
          {/** Reset the first-launch onboarding flag so the carousel shows again on
            *  the next render of the root layout - the gate (app/_layout.tsx)
            *  re-evaluates `onboarding.seen` reactively, so flipping it here
            *  immediately swaps the app for the Onboarding flow. */}
          <ListViewItem dark={dark} onPress={() => { void setOnboardingSeen(false); }}>
            <Icon name="sparkles" size={22} color={head}/>
            <Col flex={1}>
              <Text size="xl" color={head}>Replay onboarding</Text>
            </Col>
          </ListViewItem>
        </ListView>
      </ScrollView>
    </Col>
  );
}
