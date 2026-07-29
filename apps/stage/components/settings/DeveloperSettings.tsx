
import { Scroll as ScrollView } from '@stage-labs/kit/react-native/scroll';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Box, Col, WEB_EDGE_CONTENT, WEB_STACK_SCROLL, WEB_STACK_CONTENT_PAD } from '../layout';
import { Caption } from '@stage-labs/kit/react-native/caption';
import { usePalette } from '../../lib/theme';
import { setDebugConsole, useDebugConsole } from '../../lib/railgun/debugConsole';
import { StackHeader } from '../chrome/StackHeader';
import { DangerZone } from './dangerActions';
import { SettingsList, SettingsToggleRow } from './rows';

export function DeveloperSettings(): React.ReactElement {
  const { text: fg } = usePalette();
  const insets = useSafeAreaInsets();
  const enabled = useDebugConsole();

  const onToggle = (next: boolean): void => { void setDebugConsole(next); };

  return (
    <Col surface="surface" flex={1}>
      <StackHeader title="Developer"/>
      <ScrollView style={WEB_STACK_SCROLL} contentContainerStyle={[{ paddingBottom: 32 + insets.bottom }, WEB_EDGE_CONTENT, WEB_STACK_CONTENT_PAD]}>
        <Caption color={fg} style={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 }}>
          DIAGNOSTICS
        </Caption>
        <Box>
          <SettingsList>
            <SettingsToggleRow
              label="Railgun debug console"
              name="debugConsole"
              checked={enabled}
              description="Show the live Railgun bridge logs + balance-pipeline diagnostics on the Private wallet tab. Off by default - leaving it on can slow the app down."
              onChange={onToggle}
            />
          </SettingsList>
        </Box>
        <Caption color={fg} style={{ paddingHorizontal: 16, paddingTop: 28, paddingBottom: 8 }}>
          DANGER ZONE
        </Caption>
        <Box>
          <DangerZone dev />
        </Box>
      </ScrollView>
    </Col>
  );
}
