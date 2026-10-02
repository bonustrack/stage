import { usePathname, useRouter } from 'expo-router';
import { IconMagnifyingGlass } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconMagnifyingGlass';
import { useOpenNewChat } from './newChatFocus';
import { IconBubbleSparkle } from '../IconBubbleSparkle';
import { HoverIconButton } from '../hover';
import { homeRows } from './state';
import { CHANNELS_OVERFLOW_ITEMS } from './model';
import { OverflowMenu } from '../MenuRows';
import { boardViewHref, chatsViewHref } from './viewSwitch.model';
import { getActiveAccount } from '../../lib/accounts';
import { capabilities } from '../../lib/capabilities';
import { profileLinkOf } from '../../lib/links';
import { getPeerHandle } from '../../lib/peerProfiles';

type HomeView = 'chats' | 'board';

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

function HomeOverflowMenu({ color, onBoard, onChats, onProfile, onSettings }: HomeOverflowMenuProps): React.ReactElement {
  const handlers: Record<string, (() => void) | undefined> = {
    board: onBoard, chats: onChats, 'copy-address': copyActiveAddress, profile: onProfile, settings: onSettings,
  };
  return (
    <OverflowMenu color={color} items={CHANNELS_OVERFLOW_ITEMS.filter(item => handlers[item.id] !== undefined)}
      onSelect={(id) => { handlers[id]?.(); }} />
  );
}

function useViewSwitch(view: HomeView): { onBoard?: () => void; onChats?: () => void } {
  const router = useRouter();
  const pathname = usePathname();
  if (view === 'board') return { onChats: () => { router.dismissTo(chatsViewHref(pathname, homeRows() ?? [], getPeerHandle)); } };
  return { onBoard: () => { router.push(boardViewHref(pathname, homeRows() ?? [], getPeerHandle)); } };
}

export function HomeTopnavRight({ head, onOpenSearch, view }: {
  head: string; onOpenSearch?: () => void; view: HomeView;
}): React.ReactElement {
  const router = useRouter();
  const switchView = useViewSwitch(view);
  const openCompose = useOpenNewChat();
  return (
    <>
      {onOpenSearch === undefined ? null : (
        <HoverIconButton icon={IconMagnifyingGlass} label="Search" color={head} placement="below" shortcut="/" onShortcut={onOpenSearch} onPress={onOpenSearch} />
      )}
      <HoverIconButton icon={IconBubbleSparkle} label="New chat" color={head} placement="below" shortcut="c" onShortcut={openCompose} onPress={openCompose} />
      <HomeOverflowMenu
        color={head}
        onBoard={switchView.onBoard}
        onChats={switchView.onChats}
        onProfile={() => {
          void getActiveAccount().then(acct => {
            if (acct?.address) router.push(profileLinkOf(acct.address));
          });
        }}
        onSettings={() => { router.push('/settings'); }}
      />
    </>
  );
}
