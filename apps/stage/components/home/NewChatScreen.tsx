import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { errorMessage } from '@stage-labs/client/errors';
import { isRowCleared } from '@stage-labs/client/xmtp/readState';
import { Box, Col, PAGE_GUTTER, Row } from '../layout';
import { MessengerComposer } from '../composer/MessengerComposer';
import { useComposerState, type ComposerState } from '../composer/state';
import { sendDraft } from '../composer/actions';
import { resolveErrorMessage } from '../conversation/conv.hooks';
import { ConvTopnavShell } from '../conversation/parts';
import { ConversationSidebar, useConversationSidebarShown } from '../conversation/ConversationSidebar';
import { ConversationSidebarToggle } from '../conversation/ConversationSidebarToggle';
import { FooterDock } from '../conversation/FooterDock';
import { includesKey, toggleKey } from '../conversation/SidebarSection.model';
import { RecipientBar } from './RecipientBar';
import { homeRows } from './state';
import { useNewChatFocusNonce } from './newChatFocus';
import {
  NO_RECIPIENT_NOTE, chatKey, phaseNote, pickedRecipients, recipientCandidates, shownRecipients, type NewChatPhase,
} from './newChat.model';
import { resolveDmConvId } from '../../lib/dmResolve';
import { capabilities } from '../../lib/capabilities';
import { useClearedChats } from '../../lib/clearedChats';
import { getPeerName, usePeerProfiles } from '../../lib/peerProfiles';
import { useStoreValue } from '../../lib/storeCore';
import { useSafeAreaInsets } from '../../lib/safeArea';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import {
  convIdOfLine, createGroup, lineOfConv, shortAddress, subscribeCachedRows, useActiveAccountRecord,
} from '../../modules/messaging';

interface Recipients {
  shown: string[];
  picked: string[];
  toggle: (address: string) => void;
  reset: () => void;
}

function useRecipients(): Recipients {
  const rows = useStoreValue(subscribeCachedRows, homeRows);
  const cleared = useClearedChats();
  const self = useActiveAccountRecord()?.address ?? null;
  const candidates = useMemo(
    () => (rows === null ? [] : recipientCandidates(rows.filter(r => !isRowCleared(cleared, r)), self)),
    [rows, cleared, self],
  );
  const [added, setAdded] = useState<string[]>([]);
  const [chosen, setChosen] = useState<string[] | null>(null);
  const shown = useMemo(() => shownRecipients(candidates, added), [candidates, added]);
  const picked = pickedRecipients(chosen, candidates);
  usePeerProfiles(shown);
  const toggle = (address: string): void => {
    setChosen(toggleKey(picked, address));
    if (!includesKey(shown, address)) setAdded(list => [address, ...list]);
  };
  const reset = (): void => { setChosen(null); setAdded([]); };
  return { shown, picked, toggle, reset };
}

async function openRecipients(addresses: readonly string[]): Promise<string> {
  const only = addresses.length === 1 ? addresses[0] : undefined;
  if (only === undefined) return (await createGroup([...addresses])).line;
  const res = await resolveDmConvId(only);
  if ('convId' in res) return lineOfConv(res.convId);
  throw new Error(resolveErrorMessage(res.error, res.detail));
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
      const line = await openRecipients(addresses);
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
        <RecipientBar shown={recipients.shown} picked={recipients.picked} onToggle={recipients.toggle} note={phaseNote(phase)}/>
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
  const recipients = useRecipients();
  const draft = useComposerState();
  const { phase, start } = useStartChat(draft, (line) => {
    recipients.reset();
    const convId = convIdOfLine(line);
    if (convId !== null) router.replace({ pathname: '/channel/[convId]', params: { convId } });
  });
  return (
    <Col flex={1} surface="surface">
      <Box flex={1}/>
      <ConvTopnavShell fg={fg} border={border} safeTop={insets.top} onBack={() => { router.replace('/'); }}>
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
