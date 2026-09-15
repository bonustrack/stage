import * as Clipboard from 'expo-clipboard';
import { channelsOverflowItems } from './HomeScreen.model';
import { OverflowMenu } from '../MenuRows';
import { getActiveAccount } from '../../lib/accounts';
import { capabilities } from '../../lib/capabilities';

interface HomeOverflowMenuProps {
  color: string;
  onNewGroup: () => void;
  onProfile: () => void;
  onSettings: () => void;
}

function copyActiveAddress(): void {
  void getActiveAccount().then(acct => {
    if (!acct?.address) return;
    void Clipboard.setStringAsync(acct.address);
    capabilities.toast('Address copied');
  });
}

export function HomeOverflowMenu({ color, onNewGroup, onProfile, onSettings }: HomeOverflowMenuProps): React.ReactElement {
  const handlers: Record<string, () => void> = {
    new: onNewGroup, 'copy-address': copyActiveAddress, profile: onProfile, settings: onSettings,
  };
  return (
    <OverflowMenu color={color} items={channelsOverflowItems({ copyAddress: true })}
      onSelect={(id) => { handlers[id]?.(); }} />
  );
}
