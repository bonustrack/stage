import { bytesToHex } from 'viem';
import { Button } from '@stage-labs/kit/react-native/button';
import { Glyph } from '@stage-labs/kit/react-native/glyph';
import { Text } from '@stage-labs/kit/react-native/text';
import { IconPlusLarge } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconPlusLarge';
import { Col, PAGE_GUTTER } from '../layout';
import { SettingsPage } from '../settings/SettingsPage';
import { changeDashboard, useDashboard, useDashboardLoaded } from '../../lib/dashboard';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { addWidget, canAddWidget } from './dashboard.model';
import { DashboardGrid } from './DashboardGrid';

function newWidgetId(): string {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(8))).slice(2);
}

function AddWidgetButton({ disabled }: { disabled: boolean }): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const { link } = usePalette();
  return (
    <Button
      size="md" color="secondary" variant="solid" dark={dark} label="Add widget" disabled={disabled}
      iconStart={<Glyph icon={IconPlusLarge} size={18} color={link} />}
      onPress={() => { changeDashboard(widgets => addWidget(widgets, newWidgetId())); }}
    />
  );
}

function EmptyDashboard(): React.ReactElement {
  return (
    <Col align="center" gap={6} padding={{ x: PAGE_GUTTER, top: 48 }}>
      <Text value="No widgets yet" size="xs" weight="semibold" color="link" textAlign="center" />
      <Text value="Add a widget to start, then drag widgets to arrange them." size="2xs" color="secondary" textAlign="center" />
    </Col>
  );
}

export function DashboardScreen(): React.ReactElement {
  const loaded = useDashboardLoaded();
  const { widgets } = useDashboard();
  const empty = widgets.length === 0;
  return (
    <SettingsPage title="Dashboard" trailing={<AddWidgetButton disabled={!loaded || !canAddWidget(widgets)} />}>
      {loaded && empty ? <EmptyDashboard /> : null}
      {loaded && !empty ? <DashboardGrid widgets={widgets} /> : null}
    </SettingsPage>
  );
}
