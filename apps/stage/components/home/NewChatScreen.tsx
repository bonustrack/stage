import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import { useGlobalSearchParams, useRouter } from 'expo-router';
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
import { includesKey, toggleKey, uniqueKeys } from '../conversation/SidebarSection.model';
import { RecipientBar } from './RecipientBar';
import { NewChatMetadata } from './NewChatMetadata';
import { memberChatMetadata, newChatAppData, newChatMetadata, newChatParams, NO_NEW_CHAT_METADATA, type NewChatMetadata as Metadata } from './newChatMetadata.model';
import { homeRows } from './state';
import { useNewChatFocusNonce } from './newChatFocus';
import {
  NO_MEMBER_HISTORY, NO_PICKS, NO_RECIPIENT_NOTE, REQUEST_CHECK_LIMIT, askPlaceholder, membersDraftKey, newChatDraftKey, pickedRecipients,
  parseMemberHistory, rankedCandidates, recentDmPeers, recipientCandidates, rememberedMembers, savedPicks, shownRecipients,
  startedChatWith, type DmPeer, type MemberHistory,
} from './newChat.model';
import { capabilities } from '../../lib/capabilities';
import { reported } from '../../lib/errorPolicy';
import { setDraftValue } from '../../lib/drafts';
import { useClearedChats } from '../../lib/clearedChats';
import { createValueStore } from '../../lib/persistedStore';
import { usePeerProfiles } from '../../lib/peerProfiles';
import { useStoreValue } from '../../lib/storeCore';
import { useSafeAreaInsets } from '../../lib/safeArea';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { useTopChromeInset, useWebTabRail } from '../../lib/webLayout';
import { convIdOfLine } from '@stage-labs/client/xmtp/line';
import { createGroup } from '../../lib/xmtp.groups';
import { getConvConsentState } from '../../lib/xmtp.conv';
import { rememberOwnGroup } from '../../modules/messaging/useConvConsent';
import { subscribeCachedRows } from '../../lib/channelsCache';
import { uploadAttachments } from '../../lib/xmtp.attachments';
import { useActiveAccountRecord } from '../../modules/messaging/account';
import { peerLabel } from '../conversation/convTitle';

interface Recipients {
  shown: string[];
  picked: string[];
  toggle: (address: string) => void;
  reset: () => void;
}

const NO_REQUESTS: ReadonlySet<string> = new Set();

const memberHistory = createValueStore<MemberHistory>({
  key: 'new-chat.members.', default: NO_MEMBER_HISTORY, deserialize: parseMemberHistory, serialize: JSON.stringify, perAccount: true,
});

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

function useCandidates(): { candidates: string[]; remembered: string[] } {
  const rows = useStoreValue(subscribeCachedRows, homeRows);
  const cleared = useClearedChats();
  const self = useActiveAccountRecord()?.address ?? null;
  const history = memberHistory.use();
  const peers = useMemo(
    () => (rows === null ? [] : recentDmPeers(rows.filter(r => !isRowCleared(cleared, r)), self)),
    [rows, cleared, self],
  );
  const requests = useRequestPeers(peers);
  return useMemo(() => ({
    candidates: rankedCandidates(recipientCandidates(peers, self, requests), history, self),
    remembered: rememberedMembers(history, self),
  }), [peers, self, requests, history]);
}

function useRecipients(drafting: boolean, draftKey: string | null, assigned: readonly string[], self: string | null): Recipients {
  const { candidates, remembered } = useCandidates();
  const [picks, setPicks] = useState(NO_PICKS);
  useSavedDraft(membersDraftKey(draftKey), picks === NO_PICKS ? undefined : picks, (saved) => {
    const restored = savedPicks(saved);
    if (restored !== null) setPicks(restored);
  });
  const picked = uniqueKeys([...pickedRecipients(picks.chosen, candidates, remembered), ...assigned.filter(a => a !== self?.toLowerCase())]);
  const shown = shownRecipients(candidates, picks.added, picked);
  const latest = useRef({ picked, candidates });
  latest.current = { picked, candidates };
  usePeerProfiles(shown);
  useEffect(() => {
    if (drafting && picks.chosen === null && picked.length > 0) setPicks(prev => ({ ...prev, chosen: picked }));
  }, [drafting]);
  const toggle = (address: string): void => {
    setPicks(({ added }) => ({
      chosen: toggleKey(latest.current.picked, address),
      added: includesKey(added, address) || includesKey(latest.current.candidates, address) ? added : [address, ...added],
    }));
  };
  const reset = (): void => { setPicks(NO_PICKS); };
  return { shown, picked, toggle, reset };
}

function useStartChat(draft: ComposerState, draftKey: string | null, metadata: Metadata, onOpened: (convId: string) => void): {
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
      const { line } = await createGroup([...addresses], newChatAppData(metadata));
      const convId = convIdOfLine(line);
      if (convId === null) return;
      rememberOwnGroup(convId);
      void memberHistory.update(current => startedChatWith(current, addresses, Date.now())).catch(reported('newChatMembers.save'));
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
  metadata: Metadata; setMetadata: (value: Metadata) => void;
}

function NewChatForm({ recipients, draft, draftKey, creating, onSubmit, rounded, metadata, setMetadata }: FormProps & { rounded?: boolean }): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const focusNonce = useNewChatFocusNonce();
  const mentionCandidates = recipients.picked.map(address => ({ address, name: peerLabel(address) }));
  return (
    <Box style={{ pointerEvents: creating ? 'none' : 'auto' }}>
      <RecipientBar shown={recipients.shown} picked={recipients.picked} onToggle={recipients.toggle}
        onAvatarPress={Platform.OS === 'web' ? draft.bumpFocus : undefined}/>
      <MessengerComposer dark={dark} state={draft} draftKey={draftKey} suggestContacts mentionCandidates={mentionCandidates}
        placeholder={askPlaceholder(mentionCandidates.map(c => c.name))} rounded={rounded}
        metadata={<NewChatMetadata value={metadata} onChange={setMetadata}/>}
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
  const account = useActiveAccountRecord();
  const draftKey = newChatDraftKey(account);
  const metadata = newChatMetadata(useGlobalSearchParams());
  const setMetadata = (next: Metadata): void => { router.setParams(newChatParams(next)); };
  const recipients = useRecipients(draft.text.trim() !== '' || draft.pending.length > 0, draftKey, metadata.assigned, account?.address ?? null);
  const selectedMetadata = memberChatMetadata(metadata, recipients.picked, account?.address ?? null);
  const { creating, start } = useStartChat(draft, draftKey, selectedMetadata, (convId) => {
    recipients.reset();
    setMetadata(NO_NEW_CHAT_METADATA);
    router.replace({ pathname: '/channel/[convId]', params: { convId } });
  });
  const toggleRecipient = (address: string): void => {
    if (includesKey(metadata.assigned, address)) setMetadata({ ...metadata, assigned: metadata.assigned.filter(a => a.toLowerCase() !== address.toLowerCase()) });
    recipients.toggle(address);
  };
  const form = { recipients: { ...recipients, toggle: toggleRecipient }, draft, draftKey, creating, metadata: selectedMetadata, setMetadata,
    onSubmit: () => { void start(recipients.picked); } };
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
