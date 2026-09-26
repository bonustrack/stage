import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Glyph } from '@stage-labs/kit/react-native/glyph';
import { IconMagnifyingGlass } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconMagnifyingGlass';
import { HomeOverflowMenu } from './overflow';
import { NewChatModal } from './NewChatModal';
import { IconBubbleSparkle } from '../IconBubbleSparkle';
import { HoverTooltip } from '../HoverTooltip';
import { useHover } from '../hover';
import { getActiveAccount } from '../../lib/accounts';
import { profileLinkOf } from '../../lib/links';
import { usePalette } from '../../lib/theme';

export function HomeTopnavRight({ head, onOpenSearch, onBoard }: {
  head: string; onOpenSearch: () => void; onBoard?: () => void;
}): React.ReactElement {
  const router = useRouter();
  const { link } = usePalette();
  const search = useHover();
  const compose = useHover();
  const [composeOpen, setComposeOpen] = useState(false);
  return (
    <>
      <Pressable onPress={onOpenSearch} hitSlop={8} accessibilityLabel="Search" {...search.hoverProps}>
        <Glyph icon={IconMagnifyingGlass} size={24} color={search.hovered ? link : head}/>
      </Pressable>
      <HoverTooltip label="New chat" placement="below">
        <Pressable onPress={() => { setComposeOpen(true); }} hitSlop={8} accessibilityLabel="New chat" {...compose.hoverProps}>
          <Glyph icon={IconBubbleSparkle} size={24} color={compose.hovered ? link : head}/>
        </Pressable>
      </HoverTooltip>
      <NewChatModal visible={composeOpen} onClose={() => { setComposeOpen(false); }} />
      <HomeOverflowMenu
        color={head}
        onBoard={onBoard}
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
