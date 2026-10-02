import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { errorMessage } from '@stage-labs/client/errors';
import { isRowCleared } from '@stage-labs/client/xmtp/readState';
import { Box, Col, PAGE_GUTTER, Row } from '../layout';
import { MessengerComposer } from '../composer/MessengerComposer';
import { useComposerState, type ComposerState } from '../composer/state';
import { handSendTo } from '../composer/handoff';
import { startSend } from '../composer/sendRun';
import { fileInputs } from '../composer/send.model';
import { clearComposerDraft, useSavedDraft } from '../composer/hooks';
import { ConvTopnavShell } from '../conversation/parts';
import { ChatColumnSpinner, ConversationSidebar, useConversationSidebarShown } from '../conversation/ConversationSidebar';
import { ConversationSidebarToggle } from '../conversation/ConversationSidebarToggle';
import { ChatColumn, FooterDock } from '../conversation/FooterDock';
import { includesKey, toggleKey } from '../conversation/SidebarSection.model';
import { RecipientBar } from './RecipientBar';
import { homeRows } from './state';
import { useNewChatFocusNonce } from './newChatFocus';
import {
  NO_PICKS, NO_RECIPIENT_NOTE, REQUEST_CHECK_LIMIT, askPlaceholder, membersDraftKey, newChatDraftKey, pickedRecipients,
  recentDmPeers, recipientCandidates, savedPicks, shownRecipients, type DmPeer,
} from './newChat.model';
import { capabilities } from '../../lib/capabilities';
import { reported } from '../../lib/errorPolicy';
import { setDraftValue } from '../../lib/drafts';
import { useClearedChats } from '../../lib/clearedChats';
import { usePeerProfiles } from '../../lib/peerProfiles';
import { useStoreValue } from '../../lib/storeCore';
import { useSafeAreaInsets } from '../../lib/safeArea';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { useTopChromeInset, useWebTabRail } from '../../lib/webLayout';
import {
  convIdOfLine, createGroup, getConvConsentState, rememberOwnGroup, subscribeCachedRows, uploadAttachments, useActiveAccountRecord,
} from '../../modules/messaging';
import { peerLabel } from '../conversation/convTitle';

interface Recipients {
  shown: string[];
  picked: string[];
  toggle: (address: string) => void;
  reset: () => void;
}

const NO_REQUESTS: ReadonlySet<string> = new Set();

const CENTERED_MAX_WIDTH = 640;

function clearNewChatDraft(draftKey: string | null): void {
  const membersKey = membersDraftKey(draftKey);
  if (draftKey === null || membersKey === null) return;
  clearComposerDraft(draftKey);
  setDraftValue(membersKey, undefined);
}

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

function useRecipients(drafting: boolean, draftKey: string | null): Recipients {
  const candidates = useCandidates();
  const [picks, setPicks] = useState(NO_PICKS);
  useSavedDraft(membersDraftKey(draftKey), picks === NO_PICKS ? undefined : picks, (saved) => {
    const restored = savedPicks(saved);
    if (restored !== null) setPicks(restored);
  });
  const picked = pickedRecipients(picks.chosen, candidates);
  const shown = shownRecipients(candidates, picks.added, picked);
  const latest = useRef({ picked, candidates });
  latest.current = { picked, candidates };
  usePeerProfiles(shown);
  useEffect(() => {
    if (drafting && picks.chosen === null && picked.length > 0) setPicks(prev => ({ ...prev, chosen: picked }));
  }, [drafting]);
  const toggle = (address: string): void => {
    setPicks(({ added, chosen }) => ({
      chosen: toggleKey(chosen ?? latest.current.picked, address),
      added: includesKey(added, address) || includesKey(latest.current.candidates, address) ? added : [address, ...added],
    }));
  };
  const reset = (): void => { setPicks(NO_PICKS); };
  return { shown, picked, toggle, reset };
}

function useStartChat(draft: ComposerState, draftKey: string | null, onOpened: (convId: string) => void): {
  creating: boolean; start: (addresses: readonly string[]) => Promise<void>;
} {
  const [creating, setCreating] = useState(false);
  const busy = useRef(false);
  const latest = useRef(draft);
  latest.current = draft;
  const start = async (addresses: readonly string[]): Promise<void> => {
    if (busy.current) return;
    if (addresses.length === 0) { capabilities.toast(NO_RECIPIENT_NOTE); return; }
    busy.current = true;
    setCreating(true);
    uploadAttachments(fileInputs(draft.pending));
    try {
      const { line } = await createGroup([...addresses]);
      const convId = convIdOfLine(line);
      if (convId === null) return;
      rememberOwnGroup(convId);
      const { text, pending } = latest.current;
      handSendTo(convId, startSend(line, text, pending));
      clearNewChatDraft(draftKey);
      draft.setText('');
      draft.setPending([]);
      onOpened(convId);
    } catch (err) {
      capabilities.toast(errorMessage(err));
      draft.bumpFocus();
    } finally {
      busy.current = false;
      setCreating(false);
    }
  };
  return { creating, start };
}

interface FormProps {
  recipients: Recipients; draft: ComposerState; draftKey: string | null; creating: boolean; onSubmit: () => void;
}

function NewChatForm({ recipients, draft, draftKey, creating, onSubmit, rounded }: FormProps & { rounded?: boolean }): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const focusNonce = useNewChatFocusNonce();
  const mentionCandidates = recipients.picked.map(address => ({ address, name: peerLabel(address) }));
  return (
    <Box style={{ pointerEvents: creating ? 'none' : 'auto' }}>
      <RecipientBar shown={recipients.shown} picked={recipients.picked} onToggle={recipients.toggle}
        onAvatarPress={Platform.OS === 'web' ? draft.bumpFocus : undefined}/>
      <MessengerComposer dark={dark} state={draft} draftKey={draftKey} suggestContacts mentionCandidates={mentionCandidates}
        placeholder={askPlaceholder(mentionCandidates.map(c => c.name))} rounded={rounded}
        autoFocusNonce={focusNonce} busy={creating} onSubmit={onSubmit}/>
    </Box>
  );
}

function NewChatFooter(props: FormProps): React.ReactElement {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardStickyView offset={{ opened: insets.bottom }}>
      <NewChatForm {...props}/>
      <Box height={insets.bottom} surface="raised"/>
    </KeyboardStickyView>
  );
}

function CenteredNewChat(props: FormProps): React.ReactElement {
  const height = useWindowDimensions().height - useTopChromeInset();
  return (
    <Col height={height} surface="surface" align="center" justify="center" padding={{ x: PAGE_GUTTER }}>
      <Col width="100%" maxWidth={CENTERED_MAX_WIDTH}>
        <NewChatForm {...props} rounded/>
      </Col>
    </Col>
  );
}

export function NewChatScreen(): React.ReactElement {
  const router = useRouter();
  const { text: fg, border } = usePalette();
  const insets = useSafeAreaInsets();
  const memberList = useConversationSidebarShown();
  const centered = useWebTabRail();
  const [footerH, setFooterH] = useState(0);
  const draft = useComposerState();
  const draftKey = newChatDraftKey(useActiveAccountRecord());
  const recipients = useRecipients(draft.text.trim() !== '' || draft.pending.length > 0, draftKey);
  const { creating, start } = useStartChat(draft, draftKey, (convId) => {
    recipients.reset();
    router.replace({ pathname: '/channel/[convId]', params: { convId } });
  });
  const form = { recipients, draft, draftKey, creating, onSubmit: () => { void start(recipients.picked); } };
  if (centered) return <CenteredNewChat {...form}/>;
  return (
    <Col flex={1} surface="surface">
      <ChatColumn>{creating ? <ChatColumnSpinner bottomInset={footerH}/> : null}</ChatColumn>
      <ConvTopnavShell fg={fg} border={border} safeTop={insets.top} onBack={() => { capabilities.back(); }}>
        <Box flex={1}/>
        <Row align="center" padding={{ right: PAGE_GUTTER }}>
          <ConversationSidebarToggle/>
        </Row>
      </ConvTopnavShell>
      <FooterDock height={footerH} onHeight={setFooterH} memberList={memberList}>
        <NewChatFooter {...form}/>
      </FooterDock>
      {memberList ? <ConversationSidebar/> : null}
    </Col>
  );
}
