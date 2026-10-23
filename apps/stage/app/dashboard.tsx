import { DeveloperModeGate } from '../components/settings/DeveloperModeGate';
import { DashboardScreen } from '../components/dashboard/DashboardScreen';

export default function DashboardRoute(): React.ReactElement {
  return <DeveloperModeGate><DashboardScreen /></DeveloperModeGate>;
}
