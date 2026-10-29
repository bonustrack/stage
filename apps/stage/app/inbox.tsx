import { DeveloperModeGate } from '../components/settings/DeveloperModeGate';
import { InboxSettings } from '../components/settings/InboxSettings';

export default function InboxRoute(): React.ReactElement {
  return (
    <DeveloperModeGate>
      <InboxSettings />
    </DeveloperModeGate>
  );
}
