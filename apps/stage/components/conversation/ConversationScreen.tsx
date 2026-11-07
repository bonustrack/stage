import { useCallback, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useEffectiveColorScheme } from '../../lib/theme';
import { PendingConversation } from './PendingConversation';
import { RetryNotice } from '../chrome/RetryNotice';
import { ConversationFeed } from './ConversationFeed';
import { ConversationSearch, searchesFor } from './ConversationSearch';
import { useConversationState } from './useConversationState';
import { resolveErrorMessage } from './conv.hooks';
import { useResolvedConvId } from '../../lib/messaging/resolveConversation';
import { useSearchKeyboardFocus } from './searchFocus';
import { ConversationTopnav, ConversationFooter, ConversationOverlays, ConversationSearchTopnav } from './conv.screen-parts';
import { ChatColumn, ChatColumnSpinner, FooterDock, useChatColumnFill, useConversationSidebarShown, useFooterHeight } from './FooterDock';
import { ConversationSidebar } from './ConversationSidebar';
import { PeerTopnav } from './PeerTopnav';
import { Column, RIGHT_PANE_PAD } from '../layout';

export type ConversationRoute = 'peer' | 'channel';

function UnresolvedConversation({ resolved, peer }: { resolved: ReturnType<typeof useResolvedConvId>; peer?: string }): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const fill = useChatColumnFill(0);
  const memberList = useConversationSidebarShown();
  if (!resolved.resolving && resolved.pendingAddress && resolved.error) {
    return <PendingConversation address={resolved.pendingAddress} reason={resolved.error} onDelivered={resolved.retry} dark={dark} />;
  }
  return (
    <>
      <PeerTopnav peer={peer} />
      {resolved.resolving ? (
        <ChatColumnSpinner bottomInset={0} />
      ) : (
        <Column surface="surface" weight={1} align="center" justify="center" style={fill}>
          <RetryNotice message={resolveErrorMessage(resolved.error, resolved.detail)} onRetry={resolved.retry} />
        </Column>
      )}
      {memberList ? <ConversationSidebar /> : null}
    </>
  );
}

function useConversationSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
  }, []);
  const openSearch = useCallback(() => {
    setQuery('');
    setOpen(true);
  }, []);
  const inputRef = useSearchKeyboardFocus(open);
  return { open, query, setQuery, close, openSearch, inputRef };
}

function useConversationScreen(convId: string | undefined, focus: string | undefined) {
  const c = useConversationState(convId, focus);
  const memberList = useConversationSidebarShown();
  const search = useConversationSearch();
  const footer = useFooterHeight();
  return { c, memberList, search, footer };
}

export function ConversationScreen({ route }: { route: ConversationRoute }): React.ReactElement {
  const { convId: routeParam, focus } = useLocalSearchParams<{ convId: string; focus?: string }>();
  const resolved = useResolvedConvId(routeParam, route === 'peer');
  const convId = resolved.convId ?? undefined;
  const { c, memberList, search, footer } = useConversationScreen(convId, focus);

  if (resolved.resolving || !convId) {
    return (
      <Column weight={1} surface="surface">
        <UnresolvedConversation resolved={resolved} peer={route === 'peer' ? routeParam : undefined} />
      </Column>
    );
  }

  return (
    <Column weight={1} surface="surface">
      <ChatColumn style={memberList ? RIGHT_PANE_PAD : null}>
        <ConversationFeed
          feed={c.feed}
          bubbles={c.bubbles}
          conv={c.conv}
          convId={convId}
          bottomInset={footer.height}
          searchSlot={
            search.open && searchesFor(search.query) ? (
              <ConversationSearch line={c.feed.line} query={search.query} bubbles={c.bubbles} />
            ) : undefined
          }
        />
      </ChatColumn>
      {search.open ? (
        <ConversationSearchTopnav searchInputRef={search.inputRef} query={search.query} setQuery={search.setQuery} onClose={search.close} />
      ) : (
        <ConversationTopnav conv={c.conv} overflow={c.overflow} convId={convId} />
      )}
      <FooterDock height={footer.height} onHeight={footer.onHeight} memberList={memberList}>
        <ConversationFooter conv={c.conv} composer={c.composer} scroll={c.feed.scroll} convId={convId} />
      </FooterDock>
      {memberList ? <ConversationSidebar convId={convId} isGroup={c.conv.isGroup} peerAddress={c.conv.peerAddr} /> : null}
      <ConversationOverlays
        conv={c.conv}
        overflow={c.overflow}
        messageMenu={c.messageMenu}
        convId={convId}
        onOpenSearch={search.openSearch}
      />
    </Column>
  );
}
