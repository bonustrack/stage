import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { useGlobalSearchParams, useRouter } from 'expo-router';
import { channelLinkOf } from '@stage-labs/client/routing/deepLinks';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { errorMessage } from '@stage-labs/client/errors';
import { isRowCleared } from '@stage-labs/client/xmtp/sync/clear';
import { DraftComposer } from '../composer/DraftComposer';
import { useComposerState, type ComposerState } from '../composer/state';
import { discardComposerDraft, handOverSend } from '../composer/handoff';
import { startSend } from '../composer/sendRun';
import { fileInputs } from '../composer/send.model';
import { useSavedDraft } from '../composer/hooks';
import { ConvTopnavShell } from '../conversation/parts';
import { ConversationSidebar } from '../conversation/ConversationSidebar';
import { ConversationSidebarToggle } from '../conversation/ConversationSidebarToggle';
import { ChatColumn, ChatColumnSpinner, FooterDock, useConversationSidebarShown } from '../conversation/FooterDock';
import { includesKey, toggleKey, uniqueKeys } from '@stage-labs/client/collections';
import { RecipientBar } from './RecipientBar';
import { NewChatMetadata } from './NewChatMetadata';
import { NewChatProject } from './NewChatProject';
import { setNewChatProject, useNewChatDefaults } from './newChatDefaults';
import {
  memberChatMetadata,
  newChatAppData,
  newChatMetadata,
  newChatParams,
  NO_NEW_CHAT_METADATA,
  type NewChatMetadata as Metadata,
} from './newChatMetadata.model';
import { homeRows } from '../../lib/messaging/homeRows';
import { useNewChatFocusNonce } from './newChatFocus';
import {
  NO_PICKS,
  NO_RECIPIENT_NOTE,
  REQUEST_CHECK_LIMIT,
  askPlaceholder,
  firstMessageChannelName,
  membersDraftKey,
  newChatDraftKey,
  pickedRecipients,
  recentDmPeers,
  recipientCandidates,
  savedPicks,
  shownRecipients,
} from './newChat.model';
import { rankedCandidates, rememberedMembers } from '../../lib/messaging/newChatMembers.model';
import { startNewChannel, useMemberHistory, useRequestPeers } from '../../lib/messaging/newChat';
import { capabilities } from '../../lib/capabilities';
import { setDraftValue } from '../../lib/drafts';
import { useClearedChats } from '../../lib/sync/clearedChats';
import { usePeerProfiles, peerLabel } from '../../lib/peerProfiles';
import { useStoreValue } from '../../lib/storeCore';
import { useSafeAreaInsets } from '../layout/safeArea';
import { usePalette } from '../../lib/theme';
import { useContentViewportHeight, useWebTabRail } from '../layout/webLayout';
import { subscribeCachedRows } from '../../lib/channelsCache';
import { warmSendPath } from '../../lib/pushRegister';
import { useActiveAccountRecord, useSelfAddress } from '../../lib/messaging/account';
import { mentionLabelOf } from '../convIdentity';
import { Column, PAGE_GUTTER, Row } from '../layout';

interface Recipients {
  shown: string[];
  picked: string[];
  toggle: (address: string) => void;
  reset: () => void;
}

const CENTERED_MAX_WIDTH = 640;

function clearNewChatDraft(draftKey: string | null): void {
  const membersKey = membersDraftKey(draftKey);
  if (draftKey === null || membersKey === null) return;
  discardComposerDraft(draftKey);
  setDraftValue(membersKey, undefined);
}

function useCandidates(): { candidates: string[]; remembered: string[] } {
  const rows = useStoreValue(subscribeCachedRows, homeRows);
  const cleared = useClearedChats();
  const self = useSelfAddress();
  const history = useMemberHistory();
  const peers = useMemo(
    () =>
      rows === null
        ? []
        : recentDmPeers(
            rows.filter((r) => !isRowCleared(cleared, r)),
            self,
          ),
    [rows, cleared, self],
  );
  const requests = useRequestPeers(peers.slice(0, REQUEST_CHECK_LIMIT));
  return useMemo(
    () => ({
      candidates: rankedCandidates(recipientCandidates(peers, self, requests), history, self),
      remembered: rememberedMembers(history, self),
    }),
    [peers, self, requests, history],
  );
}

function useRecipients(drafting: boolean, draftKey: string | null, assigned: readonly string[], self: string | null): Recipients {
  const { candidates, remembered } = useCandidates();
  const [picks, setPicks] = useState(NO_PICKS);
  useSavedDraft(membersDraftKey(draftKey), picks === NO_PICKS ? undefined : picks, (saved) => {
    const restored = savedPicks(saved);
    if (restored !== null) setPicks(restored);
  });
  const picked = uniqueKeys([
    ...pickedRecipients(picks.chosen, candidates, remembered),
    ...assigned.filter((a) => a !== self?.toLowerCase()),
  ]);
  const shown = shownRecipients(candidates, picks.added, picked);
  const latest = useRef({ picked, candidates });
  latest.current = { picked, candidates };
  usePeerProfiles(shown);
  useEffect(() => {
    if (drafting && picks.chosen === null && picked.length > 0) setPicks((prev) => ({ ...prev, chosen: picked }));
  }, [drafting]);
  const toggle = (address: string): void => {
    setPicks(({ added }) => ({
      chosen: toggleKey(latest.current.picked, address),
      added: includesKey(added, address) || includesKey(latest.current.candidates, address) ? added : [address, ...added],
    }));
  };
  const reset = (): void => {
    setPicks(NO_PICKS);
  };
  return { shown, picked, toggle, reset };
}

function useStartChat(
  draft: ComposerState,
  draftKey: string | null,
  metadata: Metadata,
  onOpened: (convId: string) => void,
): { creating: boolean; start: (addresses: readonly string[]) => Promise<void> } {
  const [creating, setCreating] = useState(false);
  const busy = useRef(false);
  const latest = useRef(draft);
  latest.current = draft;
  const start = async (addresses: readonly string[]): Promise<void> => {
    if (busy.current) return;
    if (addresses.length === 0) {
      capabilities.toast(NO_RECIPIENT_NOTE);
      return;
    }
    busy.current = true;
    setCreating(true);
    const { text } = latest.current;
    const files = fileInputs(latest.current.pending);
    try {
      const started = await startNewChannel({
        addresses,
        files,
        appData: newChatAppData(metadata),
        name: firstMessageChannelName(text, mentionLabelOf),
      });
      if (started === null) return;
      const { line, convId } = started;
      handOverSend(convId, startSend(line, text, latest.current.pending));
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
  recipients: Recipients;
  draft: ComposerState;
  draftKey: string | null;
  creating: boolean;
  onSubmit: () => void;
  metadata: Metadata;
  setMetadata: (value: Metadata) => void;
}

function NewChatForm({
  recipients,
  draft,
  draftKey,
  creating,
  onSubmit,
  rounded,
  metadata,
  setMetadata,
}: FormProps & { rounded?: boolean }): React.ReactElement {
  const focusNonce = useNewChatFocusNonce();
  const mentionCandidates = recipients.picked.map((address) => ({ address, name: peerLabel(address) }));
  return (
    <Column style={{ pointerEvents: creating ? 'none' : 'auto' }}>
      <RecipientBar
        shown={recipients.shown}
        picked={recipients.picked}
        onToggle={recipients.toggle}
        onAvatarPress={Platform.OS === 'web' ? draft.bumpFocus : undefined}
      />
      <DraftComposer
        state={draft}
        draftKey={draftKey}
        suggestContacts
        mentionCandidates={mentionCandidates}
        placeholder={askPlaceholder(mentionCandidates.map((c) => c.name))}
        rounded={rounded}
        header={<NewChatMetadata value={metadata} onChange={setMetadata} />}
        autoFocusNonce={focusNonce}
        busy={creating}
        onSubmit={onSubmit}
      />
      <NewChatProject value={metadata.category} onChange={setNewChatProject} flush={rounded} />
    </Column>
  );
}

function NewChatFooter(props: FormProps): React.ReactElement {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardStickyView offset={{ opened: insets.bottom }}>
      <NewChatForm {...props} />
      <Column height={insets.bottom} />
    </KeyboardStickyView>
  );
}

function CenteredNewChat(props: FormProps): React.ReactElement {
  const height = useContentViewportHeight();
  return (
    <Column height={height} surface="surface" align="center" justify="center" padding={{ x: PAGE_GUTTER }}>
      <Column width="100%" maxWidth={CENTERED_MAX_WIDTH}>
        <NewChatForm {...props} rounded />
      </Column>
    </Column>
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
  const defaults = useNewChatDefaults();
  const metadata = { ...newChatMetadata(useGlobalSearchParams()), ...defaults };
  const setMetadata = (next: Metadata): void => {
    router.setParams(newChatParams(next));
  };
  const drafting = draft.text.trim() !== '' || draft.pending.length > 0;
  useEffect(() => {
    if (drafting) warmSendPath();
  }, [drafting, draft.text, draft.pending.length]);
  const recipients = useRecipients(drafting, draftKey, metadata.assigned, account?.address ?? null);
  const selectedMetadata = memberChatMetadata(metadata, recipients.picked, account?.address ?? null);
  const { creating, start } = useStartChat(draft, draftKey, selectedMetadata, (convId) => {
    recipients.reset();
    setMetadata(NO_NEW_CHAT_METADATA);
    router.replace(channelLinkOf(convId));
  });
  const toggleRecipient = (address: string): void => {
    if (includesKey(metadata.assigned, address))
      setMetadata({ ...metadata, assigned: metadata.assigned.filter((a) => a.toLowerCase() !== address.toLowerCase()) });
    recipients.toggle(address);
  };
  const form = {
    recipients: { ...recipients, toggle: toggleRecipient },
    draft,
    draftKey,
    creating,
    metadata: selectedMetadata,
    setMetadata,
    onSubmit: () => {
      void start(recipients.picked);
    },
  };
  if (centered) return <CenteredNewChat {...form} />;
  return (
    <Column weight={1} surface="surface">
      <ChatColumn>{creating ? <ChatColumnSpinner bottomInset={footerH} /> : null}</ChatColumn>
      <ConvTopnavShell
        fg={fg}
        border={border}
        safeTop={insets.top}
        onBack={() => {
          capabilities.back();
        }}
      >
        <Column weight={1} />
        <Row align="center" padding={{ right: PAGE_GUTTER }}>
          <ConversationSidebarToggle />
        </Row>
      </ConvTopnavShell>
      <FooterDock height={footerH} onHeight={setFooterH} memberList={memberList}>
        <NewChatFooter {...form} />
      </FooterDock>
      {memberList ? <ConversationSidebar /> : null}
    </Column>
  );
}
