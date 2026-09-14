

import { useSafeAreaInsets } from '../../lib/safeArea';
import { Col, ScreenScroll } from '../layout';
import { SETTINGS_MENU_ITEMS } from './SettingsMenu.model';
import { capabilities } from '../../lib/capabilities';
import { StackHeader } from '../chrome/StackHeader';
import { SettingsList, SettingsNavRow } from './rows';

export function SettingsMenu(): React.ReactElement {
  const insets = useSafeAreaInsets();


  return (
    <Col surface="surface" flex={1}>
      <StackHeader title="Settings"/>
      <ScreenScroll contentContainerStyle={{ paddingBottom: 32 + insets.bottom }}>
        <SettingsList>
          {SETTINGS_MENU_ITEMS.map((item) => (
            <SettingsNavRow
              key={item.href}
              label={item.label}
              iconStart={item.icon}
              onPress={() => { capabilities.navigate(item.href); }}
            />
          ))}
        </SettingsList>
      </ScreenScroll>
    </Col>
  );
}
