import type { ReactNode } from 'react';
import { Card } from '@stage-labs/kit/react-native/card';
import { Text } from '@stage-labs/kit/react-native/text';
import { BLOCK_RADIUS_DEFAULT } from '@stage-labs/kit/tokens';
import { useSafeAreaInsets } from '../../lib/safeArea';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { Box, Col, ScreenScroll } from '../layout';
import { SettingsHeader } from '../chrome/SettingsHeader';
import { StackHeader } from '../chrome/StackHeader';

export function SettingsPage({ title, root = false, keyboardShouldPersistTaps, children }: {
  title: string;
  root?: boolean;
  keyboardShouldPersistTaps?: 'handled';
  children: ReactNode;
}): React.ReactElement {
  const insets = useSafeAreaInsets();
  return (
    <Col surface="surface" flex={1}>
      {root ? <StackHeader title={title}/> : <SettingsHeader title={title}/>}
      <ScreenScroll
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        contentContainerStyle={{ paddingBottom: 32 + insets.bottom }}
      >
        {children}
      </ScreenScroll>
    </Col>
  );
}

export function SettingsSectionLabel({ top = 24, children }: { top?: number; children: string }): React.ReactElement {
  const { text: fg } = usePalette();
  return (
    <Text size="xs" color={fg} style={{ paddingHorizontal: 16, paddingTop: top, paddingBottom: 8 }}>
      {children}
    </Text>
  );
}

export function SettingsCard({ children }: { children: ReactNode }): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const { border } = usePalette();
  return (
    <Box margin={{ x: 16 }} radius={BLOCK_RADIUS_DEFAULT} style={{ overflow: 'hidden' }}>
      <Card dark={dark} background={border} padding={0}>
        {children}
      </Card>
    </Box>
  );
}
