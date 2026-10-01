
import { useCallback, useState } from 'react';

import { Animated as RNAnimated } from 'react-native';
import { Button } from '@stage-labs/kit/react-native/button';
import { Text } from '@stage-labs/kit/react-native/text';
import { Col, RIGHT_PANE_PAD } from '../../components/layout';
import { useLocalSearchParams, usePathname } from 'expo-router';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { PendingConversation } from '../../components/PendingConversation';
import { ConversationFeed } from '../../components/conversation/ConversationFeed';
import { ConversationSearch } from '../../components/conversation/ConversationSearch';
import { useConversationState } from '../../components/conversation/useConversationState';
import {
  useSearchKeyboardFocus, useResolvedConvId, resolveErrorMessage,
} from '../../components/conversation/conv.hooks';
import {
  ConversationTopnav, ConversationFooter, ConversationOverlays, ConversationSearchTopnav,
} from '../../components/conversation/conv.screen-parts';
import { boardPanelConvId } from '../../components/tabs/splitRoutes';
import { ChatColumn, FooterDock } from '../../components/conversation/FooterDock';
import {
  ChatColumnSpinner, ConversationSidebar, useConversationSidebarShown,
} from '../../components/conversation/ConversationSidebar';

function UnresolvedConversation({ resolved }: {
  resolved: ReturnType<typeof useResolvedConvId>;
}): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const sidebar = useConversationSidebarShown();
  if (resolved.resolving) {
    return (
      <>
        <ChatColumnSpinner bottomInset={measuredFooterHeight}/>
        {sidebar ? <ConversationSidebar/> : null}
      </>
    );
  }
  if (resolved.pendingAddress && resolved.error) {
    return (
      <PendingConversation
        address={resolved.pendingAddress}
        reason={resolved.error}
        onDelivered={resolved.retry}
        dark={dark}
      />
    );
  }
  return (
    <Col surface="surface" flex={1} align="center" justify="center" gap={16} padding={24}>
      <Text role="secondary" textAlign="center">
        {resolveErrorMessage(resolved.error, resolved.detail)}
      </Text>
      <Button dark={dark} variant="soft" label="Try again" style={{ alignSelf: 'center' }} onPress={resolved.retry}/>
    </Col>
  );
}

let measuredFooterHeight = 0;

function ConversationShell({ bg, children }: {
  bg: string; children: React.ReactNode;
}): React.ReactElement {
  return (
    <RNAnimated.View style={{ flex: 1, backgroundColor: bg }}>
      {children}
    </RNAnimated.View>
  );
}

export default function XmtpConversation(): React.ReactElement {
  const { bg } = usePalette();
  const { convId: routeParam, focus } = useLocalSearchParams<{ convId: string; focus?: string }>();
  const pathname = usePathname();
  const resolved = useResolvedConvId(routeParam, !pathname.startsWith('/channel/') && boardPanelConvId(pathname) === null);
  const convId = resolved.convId ?? undefined;
  const c = useConversationState(convId, focus);
  const { activeLine } = c;
  const memberList = useConversationSidebarShown();

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const closeSearch = useCallback(() => { setSearchOpen(false); setSearchQuery(''); }, []);
  const searchInputRef = useSearchKeyboardFocus(searchOpen);

  const [composerH, setComposerH] = useState(measuredFooterHeight);
  const onFooterHeight = useCallback((h: number) => { measuredFooterHeight = h; setComposerH(h); }, []);

  if (resolved.resolving || !convId) {
    return (
      <ConversationShell bg={bg}>
        <UnresolvedConversation resolved={resolved}/>
      </ConversationShell>
    );
  }

  return (
    <ConversationShell bg={bg}>
      <ChatColumn style={memberList ? RIGHT_PANE_PAD : null}>
      <ConversationFeed
        c={c}
        convId={convId}
        bottomInset={composerH}
        searchSlot={searchOpen && searchQuery.trim().length >= 2 ? (
          <ConversationSearch line={activeLine} query={searchQuery} c={c}/>
        ) : undefined}
/>
      </ChatColumn>
      {searchOpen ? (
        <ConversationSearchTopnav
          searchInputRef={searchInputRef}
          query={searchQuery} setQuery={setSearchQuery} onClose={closeSearch}
/>
      ) : (
        <ConversationTopnav c={c} convId={convId}/>
      )}
      <FooterDock height={composerH} onHeight={onFooterHeight} memberList={memberList}>
        <ConversationFooter c={c} convId={convId}/>
      </FooterDock>
      {memberList ? <ConversationSidebar convId={convId} isGroup={c.isGroup} peerAddress={c.peerAddr}/> : null}
      <ConversationOverlays
        c={c} convId={convId}
        onOpenSearch={() => { setSearchQuery(''); setSearchOpen(true); }}
/>
    </ConversationShell>
  );
}
