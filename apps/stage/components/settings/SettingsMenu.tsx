
import { Scroll as ScrollView } from '@stage-labs/kit/react-native/scroll';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Col, Box, WEB_EDGE_CONTENT, WEB_STACK_SCROLL, WEB_STACK_CONTENT_PAD } from '../layout';
import { useWebTabbarBottomPad } from '../tabs/webPad';
import { Text } from '@stage-labs/kit/react-native/text';
import { SETTINGS_MENU_ITEMS } from './SettingsMenu.model';
import { capabilities } from '../../lib/capabilities';
import { StackHeader } from '../chrome/StackHeader';
import { DangerZone } from './dangerActions';
import { SettingsList, SettingsNavRow } from './rows';

export function SettingsMenu(): React.ReactElement {
  const insets = useSafeAreaInsets();

  const tabbarPad = useWebTabbarBottomPad();

  return (
    <Col surface="surface" flex={1}>
      <StackHeader title="Settings"/>
      <ScrollView style={WEB_STACK_SCROLL} contentContainerStyle={[{ paddingBottom: 32 + insets.bottom }, WEB_EDGE_CONTENT, WEB_STACK_CONTENT_PAD, tabbarPad]}>
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
        <Text size="xs" role="secondary" style={{ paddingHorizontal: 16, paddingTop: 28 }}>
          DANGER ZONE
        </Text>
        <Box padding={{ top: 8 }}>
          <DangerZone />
        </Box>
      </ScrollView>
    </Col>
  );
}
