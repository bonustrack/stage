
import { Scroll as ScrollView } from '@stage-labs/kit/react-native/scroll';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Col, WEB_EDGE_SCROLL, WEB_EDGE_CONTENT } from '../layout';
import type { HeroIconName } from '@stage-labs/kit/react-native/icon';
import { capabilities } from '../../lib/capabilities';
import { SettingsHeader } from './SettingsHeader';
import { SettingsList, SettingsNavRow } from './rows';

type Href = '/settings/kit' | '/settings/components' | '/settings/developer';
const ROWS: { href: Href; label: string; icon: HeroIconName }[] = [
  { href: '/settings/kit', label: 'Kit', icon: 'colorSwatch' },
  { href: '/settings/components', label: 'Components', icon: 'viewGrid' },
  { href: '/settings/developer', label: 'Developer', icon: 'beaker' },
];

export function ExperimentalSettings(): React.ReactElement {
  const insets = useSafeAreaInsets();

  return (
    <Col surface="surface" flex={1}>
      <SettingsHeader title="Experimental"/>
      <ScrollView style={WEB_EDGE_SCROLL} contentContainerStyle={[{ paddingBottom: 32 + insets.bottom }, WEB_EDGE_CONTENT]}>
        <SettingsList>
          {ROWS.map((row) => (
            <SettingsNavRow
              key={row.href}
              label={row.label}
              iconStart={row.icon}
              onPress={() => { capabilities.navigate(row.href); }}
            />
          ))}
        </SettingsList>
      </ScrollView>
    </Col>
  );
}
