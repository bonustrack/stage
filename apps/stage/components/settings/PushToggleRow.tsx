import { usePushEnabled } from '../../lib/pushPref';
import { isPushSupported } from '../../lib/pushNotify';
import { applyPush } from '../../lib/pushToggle';
import { SettingsToggleRow } from './SettingsPage';
import { reported } from '../../lib/errorPolicy';

export const PUSH_UNAVAILABLE = 'Push notifications are unavailable in this browser.';

export function PushToggleRow({
  about,
  unsupportedNote,
  onToggled,
}: {
  about?: string;
  unsupportedNote?: string;
  onToggled?: () => void;
}): React.ReactElement {
  const enabled = usePushEnabled();
  const supported = isPushSupported();
  return (
    <SettingsToggleRow
      label="Push notifications"
      name="push"
      checked={enabled && supported}
      disabled={!supported}
      description={supported ? about : unsupportedNote}
      onChange={(next) => {
        void applyPush(next).then(onToggled).catch(reported('settings.push'));
      }}
    />
  );
}
