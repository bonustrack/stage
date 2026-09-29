import { useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { ListViewItem } from '@stage-labs/kit/react-native/list-view';
import { Glyph } from '@stage-labs/kit/react-native/glyph';
import { Text } from '@stage-labs/kit/react-native/text';
import { Button } from '@stage-labs/kit/react-native/button';
import { MODAL } from '@stage-labs/kit/react-native/modal';
import { errorMessage } from '@stage-labs/client/errors';
import { AppModal } from '../AppModal';
import { Box, Col, Row, PAGE_GUTTER } from '../layout';
import { MemberPicker, useMemberPicker, type Member } from '../group/MemberPicker';
import { GroupNameField, NewGroupDetails, createGroupLine, type PickedImage } from '../group/NewGroupForm';
import { MessengerComposer } from '../composer/MessengerComposer';
import { useComposerState, type ComposerState } from '../composer/state';
import { sendDraft } from '../composer/actions';
import { resolveErrorMessage } from '../conversation/conv.hooks';
import { resolveDmConvId } from '../../lib/dmResolve';
import { capabilities } from '../../lib/capabilities';
import { convIdOfLine, lineOfConv } from '../../modules/messaging';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import {
  chatKey, footerAction, isDirectChat, phaseNote, stepTitle, type FooterAction, type NewChatPhase, type NewChatStep,
} from './NewChatModal.model';
import { IconUserGroup } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconUserGroup';

const ACTION_ICON_SIZE = 40;

type Picker = ReturnType<typeof useMemberPicker>;

function NewGroupRow({ onPress }: { onPress: () => void }): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const { link, bg } = usePalette();
  return (
    <ListViewItem dark={dark} align="center" gap={12} onPress={onPress}
      padding={{ paddingTop: 12, paddingBottom: 12, paddingLeft: MODAL.padding, paddingRight: MODAL.padding }}>
      <Box width={ACTION_ICON_SIZE} height={ACTION_ICON_SIZE} radius="full" align="center" justify="center" background={link}>
        <Glyph icon={IconUserGroup} size={22} color={bg} />
      </Box>
      <Text value="New group" weight="semibold" />
    </ListViewItem>
  );
}

async function openConversation(members: Member[], name: string): Promise<string> {
  const only = members.length === 1 ? members[0] : undefined;
  if (only === undefined) return createGroupLine(members.map(m => m.address), name, null);
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

function NewChatBody({ step, picker, name, setName, image, setImage, creating, onGroup }: {
  step: NewChatStep; picker: Picker; name: string; setName: (name: string) => void;
  image: PickedImage | null; setImage: (image: PickedImage) => void; creating: boolean; onGroup: () => void;
}): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  if (step === 'details') {
    return <NewGroupDetails name={name} setName={setName} image={image} setImage={setImage} creating={creating} />;
  }
  const count = picker.members.length;
  const chat = step === 'chat';
  return (
    <MemberPicker key={step} state={picker} dark={dark}>
      {chat && count > 1 ? <GroupNameField name={name} setName={setName} /> : null}
      {chat && count === 0 && picker.entry.trim() === '' ? (
        <Box margin={{ x: -MODAL.padding }}><NewGroupRow onPress={onGroup} /></Box>
      ) : null}
    </MemberPicker>
  );
}

function NewChatFooter({ draft, members, action, phase, onPrimary, onBack }: {
  draft: ComposerState; members: Member[]; action: FooterAction; phase: NewChatPhase;
  onPrimary: () => void; onBack: (step: NewChatStep) => void;
}): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const { primary, bg } = usePalette();
  const note = phaseNote(phase);
  const busy = phase !== 'idle';
  const { back } = action;
  return (
    <Col>
      {note === null ? null : (
        <Box padding={{ x: PAGE_GUTTER, bottom: 8 }}><Text value={note} size="sm" role="secondary" /></Box>
      )}
      <MessengerComposer dark={dark} state={draft} suggestContacts
        mentionCandidates={members.map(m => ({ address: m.address, name: m.label }))} />
      <Row gap={8} padding={{ x: MODAL.padding, top: 12 }}>
        {back === null ? null : (
          <Button size="lg" pill dark={dark} color="secondary" variant="ghost" disabled={busy} label="Back"
            onPress={() => { onBack(back); }} />
        )}
        <Box flex={1}>
          <Button size="lg" fullWidth pill dark={dark} tintBg={primary} tintFg={bg} label={action.label}
            disabled={!action.enabled || draft.uploading} loading={busy} onPress={onPrimary} />
        </Box>
      </Row>
    </Col>
  );
}

function NewChatSheet({ onClose }: { onClose: () => void }): React.ReactElement {
  const router = useRouter();
  const [step, setStep] = useState<NewChatStep>('chat');
  const picker = useMemberPicker();
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
  const action = footerAction(step, members.length);
  const onPrimary = (): void => {
    if (action.next !== null) { setStep(action.next); return; }
    const only = isDirectChat(step, members.length) ? members[0] : undefined;
    if (only !== undefined && draft.text.trim() === '' && draft.pending.length === 0) {
      onClose();
      router.push({ pathname: '/[convId]', params: { convId: only.address } });
      return;
    }
    const addresses = members.map(m => m.address);
    const open = step === 'chat' ? () => openConversation(members, name) : () => createGroupLine(addresses, name, image);
    void start(chatKey(step, addresses), open);
  };
  return (
    <AppModal visible onClose={onClose} title={stepTitle(step)}
      footer={<NewChatFooter draft={draft} members={members} action={action} phase={phase} onPrimary={onPrimary} onBack={setStep} />}>
      <Box padding={{ bottom: MODAL.padding }}>
        <NewChatBody step={step} picker={picker} name={name} setName={setName} image={image} setImage={setImage}
          creating={phase === 'creating'} onGroup={() => { setStep('members'); }} />
      </Box>
    </AppModal>
  );
}

export function NewChatModal({ visible, onClose }: { visible: boolean; onClose: () => void }): React.ReactElement | null {
  return visible ? <NewChatSheet onClose={onClose} /> : null;
}
