import { Text } from '@stage-labs/kit/react-native/text';
import { SettingsPage } from '../settings/SettingsPage';
import { useDashboard, useDashboardLoaded } from '../../lib/dashboard';
import { useWebTabRail } from '../../lib/webLayout';
import { AddLiveWidgetButton } from './AddLiveWidget';
import { canAddWidget } from './dashboard.model';
import { DashboardGrid } from './DashboardGrid';
import { Column, PAGE_GUTTER } from '../layout';

function EmptyDashboard(): React.ReactElement {
  return (
    <Column align="center" gap={6} padding={{ x: PAGE_GUTTER, top: 48 }}>
      <Text text="No widgets yet" size="xs" fontWeight="semibold" color="link" textAlign="center" />
      <Text
        text="Add a widget from a link, or in any chat open the three-dot menu of a frame and pick Add to dashboard."
        size="2xs" color="secondary" textAlign="center"
      />
    </Column>
  );
}

export function DashboardScreen(): React.ReactElement {
  const loaded = useDashboardLoaded();
  const { widgets } = useDashboard();
  const empty = widgets.length === 0;
  const rail = useWebTabRail();
  return (
    <SettingsPage
      title="Dashboard" back={!rail} keyboardShouldPersistTaps="handled" trailing={<AddLiveWidgetButton disabled={!loaded || !canAddWidget(widgets)} />}
    >
      {loaded && empty ? <EmptyDashboard /> : null}
      {loaded && !empty ? <DashboardGrid widgets={widgets} /> : null}
    </SettingsPage>
  );
}
