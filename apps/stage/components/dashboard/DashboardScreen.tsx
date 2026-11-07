import { Text } from '@stage-labs/kit/react-native/text';
import { useDashboard, useDashboardLoaded } from '../../lib/frames/dashboard';
import { canAddWidget } from '../../lib/frames/dashboard.model';
import { MenuPage } from '../tabs/MenuPage';
import { AddLiveWidgetButton } from './AddLiveWidget';
import { DashboardGrid } from './DashboardGrid';
import { Column, PAGE_GUTTER } from '../layout';

function EmptyDashboard(): React.ReactElement {
  return (
    <Column align="center" gap={6} padding={{ x: PAGE_GUTTER, top: 48 }}>
      <Text text="No widgets yet" size="xs" fontWeight="semibold" color="link" textAlign="center" />
      <Text
        text="Add a widget from a link, or in any chat open the three-dot menu of a frame and pick Add to dashboard."
        size="2xs"
        color="secondary"
        textAlign="center"
      />
    </Column>
  );
}

function AddWidget(): React.ReactElement {
  const loaded = useDashboardLoaded();
  const { widgets } = useDashboard();
  return <AddLiveWidgetButton disabled={!loaded || !canAddWidget(widgets)} />;
}

function DashboardBody(): React.ReactElement | null {
  const loaded = useDashboardLoaded();
  const { widgets } = useDashboard();
  if (!loaded) return null;
  return widgets.length === 0 ? <EmptyDashboard /> : <DashboardGrid widgets={widgets} />;
}

export function DashboardScreen(): React.ReactElement | null {
  return (
    <MenuPage id="dashboard" keyboardShouldPersistTaps="handled" trailing={<AddWidget />}>
      <DashboardBody />
    </MenuPage>
  );
}
