
import { useSafeAreaInsets } from '../../lib/safeArea';
import { Box, Col, ScreenScroll } from '../layout';
import { Caption } from '@stage-labs/kit/react-native/caption';
import { usePalette } from '../../lib/theme';
import { setDebugConsole, useDebugConsole } from '../../lib/railgun/debugConsole';
import { StackHeader } from '../chrome/StackHeader';
import { SettingsList, SettingsToggleRow } from './rows';

export function DeveloperSettings(): React.ReactElement {
  const { text: fg } = usePalette();
  const insets = useSafeAreaInsets();
  const enabled = useDebugConsole();

  const onToggle = (next: boolean): void => { void setDebugConsole(next); };

  return (
    <Col surface="surface" flex={1}>
      <StackHeader title="Developer"/>
      <ScreenScroll contentContainerStyle={{ paddingBottom: 32 + insets.bottom }}>
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
      </ScreenScroll>
    </Col>
  );
}
