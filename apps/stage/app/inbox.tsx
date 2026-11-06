import { DeveloperModeGate } from '../components/settings/DeveloperModeGate';
import { InboxSettings } from '../components/inbox/InboxScreen';

export default function InboxRoute(): React.ReactElement {
  return (
    <DeveloperModeGate>
      <InboxSettings />
    </DeveloperModeGate>
  );
}
