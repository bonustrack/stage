
import { Scroll as ScrollView } from '@stage-labs/kit/react-native/scroll';

import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Col } from '../layout';
import type { HeroIconName } from '@stage-labs/kit/react-native/icon';
import { ChatKitRenderer } from '@stage-labs/kit/react-native/chatkit-renderer';
import type {
  ListViewNode,
  WidgetActionRegistry,
} from '@stage-labs/kit/chatkit';
import { settingsNavRow, SETTINGS_NAV_PRESS } from '@stage-labs/views';
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
  const insets = useSafeAreaInsets();

  const node: ListViewNode = {
    type: 'ListView',
    children: ROWS.map((row) =>
      settingsNavRow({
        label: row.label,
        iconStart: row.icon,
        pressType: SETTINGS_NAV_PRESS,
        payload: { href: row.href },
      }),
    ),
  };

  const registry: WidgetActionRegistry = {
    [SETTINGS_NAV_PRESS]: (action) => {
      const href = action.payload.href;
      if (typeof href === 'string') router.push(href);
    },
  };

  return (
    <Col surface="surface" flex={1}>
      <SystemHeader title="Experimental" dark={dark} fg={fg} head={head} border={border}/>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 + insets.bottom }}>
        <ChatKitRenderer node={node} registry={registry}/>
      </ScrollView>
    </Col>
  );
}
