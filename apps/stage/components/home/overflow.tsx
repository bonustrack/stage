import { CHANNELS_OVERFLOW_ITEMS } from './model';
import { OverflowMenu } from '../MenuRows';
import { getActiveAccount } from '../../lib/accounts';
import { capabilities } from '../../lib/capabilities';

interface HomeOverflowMenuProps {
  color: string;
  onProfile: () => void;
  onSettings: () => void;
}

function copyActiveAddress(): void {
  void getActiveAccount().then(acct => {
    if (!acct?.address) return;
    capabilities.copy('Address', acct.address);
  });
}

export function HomeOverflowMenu({ color, onProfile, onSettings }: HomeOverflowMenuProps): React.ReactElement {
  const handlers: Record<string, () => void> = {
    'copy-address': copyActiveAddress, profile: onProfile, settings: onSettings,
  };
  return (
    <OverflowMenu color={color} items={CHANNELS_OVERFLOW_ITEMS}
      onSelect={(id) => { handlers[id]?.(); }} />
  );
}
