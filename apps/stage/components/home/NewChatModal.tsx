import { useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { Tabs } from '@stage-labs/kit/react-native/tabs';
import { Text } from '@stage-labs/kit/react-native/text';
import { Button } from '@stage-labs/kit/react-native/button';
import { MODAL } from '@stage-labs/kit/react-native/modal';
import { errorMessage } from '@stage-labs/client/errors';
import { AppModal } from '../AppModal';
import { FORM_FIELD_RADIUS } from '../FormField';
import { Box, Col, PAGE_GUTTER } from '../layout';
import { MemberPicker, useMemberPicker, type Member } from '../channel/MemberPicker';
import { NewChannelDetails, createChannelLine, type PickedImage } from '../channel/NewChannelForm';
import { MessengerComposer } from '../composer/MessengerComposer';
import { useComposerState, type ComposerState } from '../composer/state';
import { sendDraft } from '../composer/actions';
import { resolveErrorMessage } from '../conversation/conv.hooks';
import { resolveDmConvId } from '../../lib/dmResolve';
import { capabilities } from '../../lib/capabilities';
import { convIdOfLine, lineOfConv } from '../../modules/messaging';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import {
  MODE_TABS, chatKey, footerAction, isNewChatMode, phaseNote, type FooterAction, type NewChatMode, type NewChatPhase,
} from './NewChatModal.model';

type Picker = ReturnType<typeof useMemberPicker>;

async function openConversation(mode: NewChatMode, members: Member[], name: string, image: PickedImage | null): Promise<string> {
  const only = members[0];
  if (mode === 'channel' || only === undefined) return createChannelLine(members.map(m => m.address), name, image);
  const res = await resolveDmConvId(only.address);
  if ('convId' in res) return lineOfConv(res.convId);
  throw new Error(resolveErrorMessage(res.error, res.detail));
}

function useStartChat(draft: ComposerState, onOpened: (line: string) => void): {
  phase: NewChatPhase; start: (key: string, open: () => Promise<string>) => Promise<void>;
} {
  const [phase, setPhase] = useState<NewChatPhase>('idle');
  const opened = useRef<{ key: string; line: string } | null>(null);
  const busy = useRef(false);
  const latest = useRef(draft);
  latest.current = draft;
  const lineFor = async (key: string, open: () => Promise<string>): Promise<string | null> => {
    if (opened.current?.key === key) return opened.current.line;
    setPhase('creating');
    try {
      const line = await open();
      opened.current = { key, line };
      return line;
    } catch (err) {
      capabilities.toast(errorMessage(err));
      return null;
    }
  };
  const start = async (key: string, open: () => Promise<string>): Promise<void> => {
    if (busy.current) return;
    busy.current = true;
    latest.current.bumpBlur();
    try {
      const line = await lineFor(key, open);
      if (line === null) return;
      setPhase('sending');
      if (await sendDraft(latest.current, line)) onOpened(line);
    } finally {
      busy.current = false;
      setPhase('idle');
    }
  };
  return { phase, start };
}

function NewChatBody({ mode, setMode, picker, name, setName, image, setImage, phase }: {
  mode: NewChatMode; setMode: (mode: NewChatMode) => void; picker: Picker; name: string; setName: (name: string) => void;
  image: PickedImage | null; setImage: (image: PickedImage) => void; phase: NewChatPhase;
}): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  return (
    <Col gap={12}>
      <Box style={{ pointerEvents: phase === 'idle' ? 'auto' : 'none' }}>
        <Tabs value={mode} options={MODE_TABS} onChange={(v) => { if (isNewChatMode(v)) setMode(v); }} />
      </Box>
      {mode === 'channel' ? (
        <NewChannelDetails name={name} setName={setName} image={image} setImage={setImage} creating={phase === 'creating'} />
      ) : null}
      <MemberPicker state={picker} dark={dark} />
    </Col>
  );
}

function NewChatFooter({ draft, members, action, phase, onPrimary }: {
  draft: ComposerState; members: Member[]; action: FooterAction; phase: NewChatPhase; onPrimary: () => void;
}): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const { primary, bg } = usePalette();
  const note = phaseNote(phase);
  const busy = phase !== 'idle';
  return (
    <Col>
      {note === null ? null : (
        <Box padding={{ x: PAGE_GUTTER, bottom: 8 }}><Text value={note} size="sm" role="secondary" /></Box>
      )}
      <Box padding={{ x: MODAL.padding }} style={{ pointerEvents: busy ? 'none' : 'auto' }}>
        <MessengerComposer dark={dark} state={draft} suggestContacts radius={FORM_FIELD_RADIUS}
          mentionCandidates={members.map(m => ({ address: m.address, name: m.label }))} />
      </Box>
      <Box padding={{ x: MODAL.padding, top: 12 }}>
        <Button size="lg" fullWidth pill dark={dark} tintBg={primary} tintFg={bg} label={action.label}
          disabled={!action.enabled || draft.uploading} loading={busy} onPress={onPrimary} />
      </Box>
    </Col>
  );
}

function NewChatSheet({ onClose }: { onClose: () => void }): React.ReactElement {
  const router = useRouter();
  const [mode, setMode] = useState<NewChatMode>('dm');
  const picker = useMemberPicker(mode === 'dm');
  const [name, setName] = useState('');
  const [image, setImage] = useState<PickedImage | null>(null);
  const draft = useComposerState();
  const openChat = (line: string): void => {
    const convId = convIdOfLine(line);
    onClose();
    if (convId !== null) router.push({ pathname: '/channel/[convId]', params: { convId } });
  };
  const { phase, start } = useStartChat(draft, openChat);
  const { members } = picker;
  const action = footerAction(mode, members.length);
  const onPrimary = (): void => {
    const only = mode === 'dm' ? members[0] : undefined;
    if (only !== undefined && draft.text.trim() === '' && draft.pending.length === 0) {
      onClose();
      router.push({ pathname: '/[convId]', params: { convId: only.address } });
      return;
    }
    void start(chatKey(mode, members.map(m => m.address)), () => openConversation(mode, members, name, image));
  };
  return (
    <AppModal visible onClose={onClose} title="New chat" dismissable={phase === 'idle'}
      footer={<NewChatFooter draft={draft} members={members} action={action} phase={phase} onPrimary={onPrimary} />}>
      <Box padding={{ bottom: MODAL.padding }}>
        <NewChatBody mode={mode} setMode={setMode} picker={picker} name={name} setName={setName} image={image} setImage={setImage}
          phase={phase} />
      </Box>
    </AppModal>
  );
}

export function NewChatModal({ visible, onClose }: { visible: boolean; onClose: () => void }): React.ReactElement | null {
  return visible ? <NewChatSheet onClose={onClose} /> : null;
}
