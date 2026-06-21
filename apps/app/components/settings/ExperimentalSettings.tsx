
import { Scroll as ScrollView } from '@stage-labs/kit/react-native/scroll';

import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Col } from '../layout';
import { Icon, type HeroIconName } from '@stage-labs/kit/react-native/icon';
import { Text } from '@stage-labs/kit/react-native/text';
import { ListView, ListViewItem } from '@stage-labs/kit/react-native/list-view';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { SystemHeader } from '../system/SystemHeader';

type Href = '/settings/kit' | '/settings/components' | '/settings/developer';
const ROWS: { href: Href; label: string; icon: HeroIconName }[] = [
  { href: '/settings/kit', label: 'Kit', icon: 'colorSwatch' },
  { href: '/settings/components', label: 'Components', icon: 'viewGrid' },
  { href: '/settings/developer', label: 'Developer', icon: 'beaker' },
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
            <ListViewItem key={row.href} dark={dark} onPress={() => { router.push(row.href); }}>
              <Icon name={row.icon} size={22} color={head}/>
              <Col flex={1}>
                <Text size="xl" color={head}>{row.label}</Text>
              </Col>
              <Icon name="chevronRight" size={18} color={sub}/>
            </ListViewItem>
          ))}
        </ListView>
      </ScrollView>
    </Col>
  );
}
