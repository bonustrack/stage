
import { Scroll as ScrollView } from '@stage-labs/kit/react-native/scroll';

import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Col } from '../layout';
import type { HeroIconName } from '@stage-labs/kit/react-native/icon';
import { ViewHost } from '@stage-labs/kit/react-native/view-host';
import type {
  ListViewNode,
  PayloadHandlers,
} from '@stage-labs/kit/kit';
import { settingsHeader, settingsNavRow, SCREEN_BACK, SETTINGS_NAV_PRESS } from '@stage-labs/views';
import { usePalette } from '../../lib/theme';

type Href = '/settings/kit' | '/settings/components' | '/settings/developer';
const ROWS: { href: Href; label: string; icon: HeroIconName }[] = [
  { href: '/settings/kit', label: 'Kit', icon: 'colorSwatch' },
  { href: '/settings/components', label: 'Components', icon: 'viewGrid' },
  { href: '/settings/developer', label: 'Developer', icon: 'beaker' },
];

export function ExperimentalSettings(): React.ReactElement {
  const router = useRouter();
  const { text: fg, link: head, border, toolbarBg } = usePalette();
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

  const headerNode = settingsHeader({
    title: 'Experimental',
    backColor: fg,
    titleColor: head,
    surface: toolbarBg,
    borderColor: border,
    safeTop: insets.top,
  });

  const actions: PayloadHandlers = {
    [SCREEN_BACK]: () => { router.back(); },
    [SETTINGS_NAV_PRESS]: (payload) => {
      const href = payload.href;
      if (typeof href === 'string') router.push(href);
    },
  };

  return (
    <Col surface="surface" flex={1}>
      <ViewHost node={headerNode} actions={actions}/>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 + insets.bottom }}>
        <ViewHost node={node} actions={actions}/>
      </ScrollView>
    </Col>
  );
}
