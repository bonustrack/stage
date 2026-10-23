import { DeveloperModeGate } from '../components/settings/DeveloperModeGate';
import { StorageScreen } from '../components/storage/StorageScreen';

export default function StorageRoute(): React.ReactElement {
  return <DeveloperModeGate><StorageScreen /></DeveloperModeGate>;
}
