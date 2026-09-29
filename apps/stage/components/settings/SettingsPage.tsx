import type { ReactNode } from 'react';
import { Platform } from 'react-native';
import type { SimultaneousRefs } from '../SwipeTabs.types';
import { Card } from '@stage-labs/kit/react-native/card';
import { Caption } from '@stage-labs/kit/react-native/caption';
import { BLOCK_RADIUS_DEFAULT } from '@stage-labs/kit/tokens';
import { useSafeAreaInsets } from '../../lib/safeArea';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { Box, Col, ScreenScroll, PAGE_GUTTER } from '../layout';
import { SettingsHeader } from '../chrome/SettingsHeader';
import { StackHeader } from '../chrome/StackHeader';
import { Eyebrow } from '../Eyebrow';
import { SettingsList } from './rows';

export function SettingsPage({ title, root = false, panRef, keyboardShouldPersistTaps, children }: {
  title: string;
  root?: boolean;
  panRef?: SimultaneousRefs;
  keyboardShouldPersistTaps?: 'handled';
  children: ReactNode;
}): React.ReactElement {
  const insets = useSafeAreaInsets();
  return (
    <Col surface="surface" flex={1}>
      {root ? (Platform.OS === 'web' ? <StackHeader title={title}/> : null) : <SettingsHeader title={title}/>}
      <ScreenScroll
        simultaneousHandlers={panRef}
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
    <Eyebrow color={fg} style={{ paddingHorizontal: PAGE_GUTTER, paddingTop: top, paddingBottom: 8, textTransform: 'uppercase' }}>
      {children}
    </Eyebrow>
  );
}

export function SettingsCard({ children }: { children: ReactNode }): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const { border } = usePalette();
  return (
    <Box margin={{ x: PAGE_GUTTER }} radius={BLOCK_RADIUS_DEFAULT} style={{ overflow: 'hidden' }}>
      <Card dark={dark} background={border} padding={0}>
        {children}
      </Card>
    </Box>
  );
}

export function SettingsGroup({ title, footnote, children }: {
  title?: string;
  footnote?: string;
  children: ReactNode;
}): React.ReactElement {
  return (
    <Col>
      {title === undefined ? <Box height={24} /> : <SettingsSectionLabel>{title}</SettingsSectionLabel>}
      <SettingsCard>
        <SettingsList>{children}</SettingsList>
      </SettingsCard>
      {footnote === undefined ? null : (
        <Caption value={footnote} color="secondary" style={{ paddingHorizontal: PAGE_GUTTER + 16, paddingTop: 8 }} />
      )}
    </Col>
  );
}
