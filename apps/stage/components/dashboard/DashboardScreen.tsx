import { Text } from '@stage-labs/kit/react-native/text';
import { Col, PAGE_GUTTER } from '../layout';
import { SettingsPage } from '../settings/SettingsPage';
import { useDashboard, useDashboardLoaded } from '../../lib/dashboard';
import { DashboardGrid } from './DashboardGrid';

function EmptyDashboard(): React.ReactElement {
  return (
    <Col align="center" gap={6} padding={{ x: PAGE_GUTTER, top: 48 }}>
      <Text value="No widgets yet" size="xs" weight="semibold" color="link" textAlign="center" />
      <Text
        value="In any chat, open the menu of a frame (right click, or long press on a phone) and pick Add to dashboard."
        size="2xs" color="secondary" textAlign="center"
      />
    </Col>
  );
}

export function DashboardScreen(): React.ReactElement {
  const loaded = useDashboardLoaded();
  const { widgets } = useDashboard();
  const empty = widgets.length === 0;
  return (
    <SettingsPage title="Dashboard" keyboardShouldPersistTaps="handled">
      {loaded && empty ? <EmptyDashboard /> : null}
      {loaded && !empty ? <DashboardGrid widgets={widgets} /> : null}
    </SettingsPage>
  );
}
