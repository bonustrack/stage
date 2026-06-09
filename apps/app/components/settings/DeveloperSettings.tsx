/** Settings → Developer - device-local diagnostic toggles.
 *
 *  Currently a single Switch wired to the Railgun debug-console preference
 *  (lib/railgun/debugConsole, default OFF). When ON, the Private wallet tab
 *  renders the balance-pipeline panel + the Node-bridge ping probe, which stream
 *  the engine's live bridge logs (the +0ms scan[...] / rx event lines). Those
 *  blocks were always mounted before and streamed continuously, which made the
 *  phone laggy - they are now opt-in here. */

import { useEffect, useState } from 'react';

import { Switch } from 'react-native';
import { Scroll as ScrollView } from '@metro-labs/kit/scroll';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Box, Col, Row } from '../layout';
import { Text } from '@metro-labs/kit/text';
import { useBlockRadius, useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { SystemHeader } from '../system/SystemHeader';
import {
  isDebugConsoleEnabled, loadDebugConsole, setDebugConsole, subscribeDebugConsole,
} from '../../lib/railgun/debugConsole';

export function DeveloperSettings(): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const { text: fg, link: head, bg, border } = usePalette();
  const sub = fg;
  const rowBg = border;
  const insets = useSafeAreaInsets();
  const blockRadius = useBlockRadius();
  const [enabled, setEnabled] = useState(isDebugConsoleEnabled());

  useEffect(() => {
    void loadDebugConsole().then(setEnabled);
    return subscribeDebugConsole(() => setEnabled(isDebugConsoleEnabled()));
  }, []);

  const onToggle = (next: boolean): void => {
    setEnabled(next); // optimistic
    void setDebugConsole(next);
  };

  return (
    <Col flex={1} style={{ backgroundColor: bg }}>
      <SystemHeader title="Developer" dark={dark} fg={fg} head={head} border={border} />
      <ScrollView contentContainerStyle={{ paddingBottom: 32 + insets.bottom }}>
        <Text size="xs" color={sub} style={{ paddingHorizontal: 16, paddingTop: 20 }}>
          DIAGNOSTICS
        </Text>
        <Box
          mx={16} mt={8} p={14} style={{ borderRadius: blockRadius, backgroundColor: rowBg, borderWidth: 1, borderColor: border }}
        >
          <Row align="center" gap={12}>
            <Col flex={1} style={{ minWidth: 0 }}>
              <Text weight="semibold" size="md" color={head}>Railgun debug console</Text>
              <Text size="xs" color={sub} style={{ marginTop: 2 }}>
                Show the live Railgun bridge logs + balance-pipeline diagnostics on the Private wallet tab. Off by default - leaving it on can slow the app down.
              </Text>
            </Col>
            <Switch value={enabled} onValueChange={onToggle} />
          </Row>
        </Box>
      </ScrollView>
    </Col>
  );
}
