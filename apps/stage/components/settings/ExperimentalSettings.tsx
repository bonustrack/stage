

import { useSafeAreaInsets } from '../../lib/safeArea';
import { Col, ScreenScroll } from '../layout';
import type { HeroIconName } from '@stage-labs/kit/react-native/icon';
import { capabilities } from '../../lib/capabilities';
import { StackHeader } from '../chrome/StackHeader';
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
      <StackHeader title="Experimental"/>
      <ScreenScroll contentContainerStyle={{ paddingBottom: 32 + insets.bottom }}>
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
      </ScreenScroll>
    </Col>
  );
}
