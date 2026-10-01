import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { errorMessage } from '@stage-labs/client/errors';
import { isRowCleared } from '@stage-labs/client/xmtp/readState';
import { Box, Col, PAGE_GUTTER, Row } from '../layout';
import { MessengerComposer } from '../composer/MessengerComposer';
import { useComposerState, type ComposerState } from '../composer/state';
import { sendDraft } from '../composer/actions';
import { ConvTopnavShell } from '../conversation/parts';
import { ChatColumnSpinner, ConversationSidebar, useConversationSidebarShown } from '../conversation/ConversationSidebar';
import { ConversationSidebarToggle } from '../conversation/ConversationSidebarToggle';
import { ChatColumn, FooterDock } from '../conversation/FooterDock';
import { includesKey, toggleKey } from '../conversation/SidebarSection.model';
import { RecipientBar } from './RecipientBar';
import { homeRows } from './state';
import { useNewChatFocusNonce } from './newChatFocus';
import {
  NO_RECIPIENT_NOTE, REQUEST_CHECK_LIMIT, chatKey, pickedRecipients, recentDmPeers, recipientCandidates, shownRecipients,
  type DmPeer, type NewChatPhase,
} from './newChat.model';
import { capabilities } from '../../lib/capabilities';
import { reported } from '../../lib/errorPolicy';
import { useClearedChats } from '../../lib/clearedChats';
import { getPeerName, usePeerProfiles } from '../../lib/peerProfiles';
import { useStoreValue } from '../../lib/storeCore';
import { useSafeAreaInsets } from '../../lib/safeArea';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import {
  convIdOfLine, createGroup, getConvConsentState, shortAddress, subscribeCachedRows, useActiveAccountRecord,
} from '../../modules/messaging';

interface Recipients {
  shown: string[];
  picked: string[];
  toggle: (address: string) => void;
  reset: () => void;
}

const NO_REQUESTS: ReadonlySet<string> = new Set();

function useRequestPeers(peers: readonly DmPeer[]): ReadonlySet<string> {
  const [requests, setRequests] = useState(NO_REQUESTS);
  const checked = peers.slice(0, REQUEST_CHECK_LIMIT);
  const key = checked.map(p => p.convId).join(',');
  useEffect(() => {
    let cancelled = false;
    void Promise.all(checked.map(async p => ((await getConvConsentState(p.convId)) === 'unknown' ? [p.peer] : [])))
      .then((found) => { if (!cancelled) setRequests(new Set(found.flat())); })
      .catch(reported('newChat.requests'));
    return () => { cancelled = true; };
  }, [key]);
  return requests;
}

function useCandidates(): string[] {
  const rows = useStoreValue(subscribeCachedRows, homeRows);
  const cleared = useClearedChats();
  const self = useActiveAccountRecord()?.address ?? null;
  const peers = useMemo(
    () => (rows === null ? [] : recentDmPeers(rows.filter(r => !isRowCleared(cleared, r)), self)),
    [rows, cleared, self],
  );
  const requests = useRequestPeers(peers);
  return useMemo(() => recipientCandidates(peers, self, requests), [peers, self, requests]);
}

function useRecipients(drafting: boolean): Recipients {
  const candidates = useCandidates();
  const [added, setAdded] = useState<string[]>([]);
  const [chosen, setChosen] = useState<string[] | null>(null);
  const picked = pickedRecipients(chosen, candidates);
  const shown = shownRecipients(candidates, added, picked);
  const latest = useRef({ picked, candidates });
  latest.current = { picked, candidates };
  usePeerProfiles(shown);
  useEffect(() => {
    if (drafting && chosen === null && picked.length > 0) setChosen(picked);
  }, [drafting]);
  const toggle = (address: string): void => {
    setChosen(prev => toggleKey(prev ?? latest.current.picked, address));
    setAdded(list => (includesKey(list, address) || includesKey(latest.current.candidates, address) ? list : [address, ...list]));
  };
  const reset = (): void => { setChosen(null); setAdded([]); };
  return { shown, picked, toggle, reset };
}

async function createChannel(addresses: readonly string[]): Promise<string> {
  return (await createGroup([...addresses])).line;
}

function useStartChat(draft: ComposerState, onOpened: (line: string) => void): {
  phase: NewChatPhase; start: (addresses: readonly string[]) => Promise<void>;
} {
  const [phase, setPhase] = useState<NewChatPhase>('idle');
  const opened = useRef<{ key: string; line: string } | null>(null);
  const busy = useRef(false);
  const latest = useRef(draft);
  latest.current = draft;
  const lineFor = async (addresses: readonly string[]): Promise<string | null> => {
    const key = chatKey(addresses);
    if (opened.current?.key === key) return opened.current.line;
    setPhase('creating');
    try {
      const line = await createChannel(addresses);
      opened.current = { key, line };
      return line;
    } catch (err) {
      capabilities.toast(errorMessage(err));
      return null;
    }
  };
  const start = async (addresses: readonly string[]): Promise<void> => {
    if (busy.current) return;
    if (addresses.length === 0) { capabilities.toast(NO_RECIPIENT_NOTE); return; }
    busy.current = true;
    try {
      const line = await lineFor(addresses);
      if (line === null) return;
      setPhase('sending');
      if (await sendDraft(latest.current, line)) {
        opened.current = null;
        onOpened(line);
      }
    } finally {
      busy.current = false;
      setPhase('idle');
    }
  };
  return { phase, start };
}

function NewChatFooter({ recipients, draft, phase, onSubmit }: {
  recipients: Recipients; draft: ComposerState; phase: NewChatPhase; onSubmit: () => void;
}): React.ReactElement {
  const insets = useSafeAreaInsets();
  const dark = useEffectiveColorScheme() === 'dark';
  const focusNonce = useNewChatFocusNonce();
  const mentionCandidates = recipients.picked.map(address => ({ address, name: getPeerName(address) ?? shortAddress(address) }));
  return (
    <KeyboardStickyView offset={{ opened: insets.bottom }}>
      <Box style={{ pointerEvents: phase === 'idle' ? 'auto' : 'none' }}>
        <RecipientBar shown={recipients.shown} picked={recipients.picked} onToggle={recipients.toggle}
          onAvatarPress={Platform.OS === 'web' ? draft.bumpFocus : undefined}/>
        <MessengerComposer dark={dark} state={draft} suggestContacts mentionCandidates={mentionCandidates}
          autoFocusNonce={focusNonce} onSubmit={onSubmit}/>
        <Box height={insets.bottom} surface="raised"/>
      </Box>
    </KeyboardStickyView>
  );
}

export function NewChatScreen(): React.ReactElement {
  const router = useRouter();
  const { text: fg, border } = usePalette();
  const insets = useSafeAreaInsets();
  const memberList = useConversationSidebarShown();
  const [footerH, setFooterH] = useState(0);
  const draft = useComposerState();
  const recipients = useRecipients(draft.text.trim() !== '' || draft.pending.length > 0);
  const { phase, start } = useStartChat(draft, (line) => {
    recipients.reset();
    const convId = convIdOfLine(line);
    if (convId !== null) router.replace({ pathname: '/channel/[convId]', params: { convId } });
  });
  return (
    <Col flex={1} surface="surface">
      <ChatColumn>{phase === 'idle' ? null : <ChatColumnSpinner bottomInset={footerH}/>}</ChatColumn>
      <ConvTopnavShell fg={fg} border={border} safeTop={insets.top} onBack={() => { if (router.canGoBack()) router.back(); else router.replace('/'); }}>
        <Box flex={1}/>
        <Row align="center" padding={{ right: PAGE_GUTTER }}>
          <ConversationSidebarToggle/>
        </Row>
      </ConvTopnavShell>
      <FooterDock height={footerH} onHeight={setFooterH} memberList={memberList}>
        <NewChatFooter recipients={recipients} draft={draft} phase={phase} onSubmit={() => { void start(recipients.picked); }}/>
      </FooterDock>
      {memberList ? <ConversationSidebar/> : null}
    </Col>
  );
}
