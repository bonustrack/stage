import { useState } from 'react';
import { usePathname, useRouter } from 'expo-router';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Glyph } from '@stage-labs/kit/react-native/glyph';
import { IconMagnifyingGlass } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconMagnifyingGlass';
import { HomeOverflowMenu } from './overflow';
import { NewChatModal } from './NewChatModal';
import { IconBubbleSparkle } from '../IconBubbleSparkle';
import { HoverTooltip } from '../HoverTooltip';
import { useHover } from '../hover';
import { homeRows } from './state';
import { boardViewHref, chatsViewHref } from './viewSwitch.model';
import { getActiveAccount } from '../../lib/accounts';
import { profileLinkOf } from '../../lib/links';
import { getPeerHandle } from '../../lib/peerProfiles';
import { usePalette } from '../../lib/theme';

type HomeView = 'chats' | 'board';

function useViewSwitch(view: HomeView): { onBoard?: () => void; onChats?: () => void } {
  const router = useRouter();
  const pathname = usePathname();
  if (view === 'board') return { onChats: () => { router.dismissTo(chatsViewHref(pathname, homeRows() ?? [], getPeerHandle)); } };
  return { onBoard: () => { router.push(boardViewHref(pathname, homeRows() ?? [], getPeerHandle)); } };
}

export function HomeTopnavRight({ head, onOpenSearch, view }: {
  head: string; onOpenSearch: () => void; view: HomeView;
}): React.ReactElement {
  const router = useRouter();
  const switchView = useViewSwitch(view);
  const { link } = usePalette();
  const search = useHover();
  const compose = useHover();
  const [composeOpen, setComposeOpen] = useState(false);
  const openCompose = (): void => { setComposeOpen(true); };
  return (
    <>
      <HoverTooltip label="Search" placement="below" shortcut="/" onShortcut={onOpenSearch}>
        <Pressable onPress={onOpenSearch} hitSlop={8} accessibilityLabel="Search" {...search.hoverProps}>
          <Glyph icon={IconMagnifyingGlass} size={24} color={search.hovered ? link : head}/>
        </Pressable>
      </HoverTooltip>
      <HoverTooltip label="New chat" placement="below" shortcut="c" onShortcut={openCompose}>
        <Pressable onPress={openCompose} hitSlop={8} accessibilityLabel="New chat" {...compose.hoverProps}>
          <Glyph icon={IconBubbleSparkle} size={24} color={compose.hovered ? link : head}/>
        </Pressable>
      </HoverTooltip>
      <NewChatModal visible={composeOpen} onClose={() => { setComposeOpen(false); }} />
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
