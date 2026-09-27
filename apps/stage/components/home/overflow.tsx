import { CHANNELS_OVERFLOW_ITEMS } from './model';
import { OverflowMenu } from '../MenuRows';
import { getActiveAccount } from '../../lib/accounts';
import { capabilities } from '../../lib/capabilities';

interface HomeOverflowMenuProps {
  color: string;
  onBoard?: () => void;
  onChats?: () => void;
  onProfile: () => void;
  onSettings: () => void;
}

function copyActiveAddress(): void {
  void getActiveAccount().then(acct => {
    if (!acct?.address) return;
    capabilities.copy('Address', acct.address);
  });
}

export function HomeOverflowMenu({ color, onBoard, onChats, onProfile, onSettings }: HomeOverflowMenuProps): React.ReactElement {
  const handlers: Record<string, (() => void) | undefined> = {
    board: onBoard, chats: onChats, 'copy-address': copyActiveAddress, profile: onProfile, settings: onSettings,
  };
  return (
    <OverflowMenu color={color} items={CHANNELS_OVERFLOW_ITEMS.filter(item => handlers[item.id] !== undefined)}
      onSelect={(id) => { handlers[id]?.(); }} />
  );
}
