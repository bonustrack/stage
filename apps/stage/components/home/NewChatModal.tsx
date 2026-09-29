import { useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { ListViewItem } from '@stage-labs/kit/react-native/list-view';
import { Glyph } from '@stage-labs/kit/react-native/glyph';
import { Text } from '@stage-labs/kit/react-native/text';
import { Button } from '@stage-labs/kit/react-native/button';
import { MODAL } from '@stage-labs/kit/react-native/modal';
import { errorMessage } from '@stage-labs/client/errors';
import { AppModal } from '../AppModal';
import { Box, Col, PAGE_GUTTER } from '../layout';
import { MemberPicker, useMemberPicker, type Member } from '../group/MemberPicker';
import { GroupNameField, NewGroupForm } from '../group/NewGroupForm';
import { MessengerComposer } from '../composer/MessengerComposer';
import { resolveErrorMessage } from '../conversation/conv.hooks';
import { resolveDmConvId } from '../../lib/dmResolve';
import { capabilities } from '../../lib/capabilities';
import { convIdOfLine, createGroup, lineOfConv } from '../../modules/messaging';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { openChatLabel, phaseNote, recipientsKey, type NewChatPhase } from './NewChatModal.model';
import { IconUserGroup } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconUserGroup';

const ACTION_ICON_SIZE = 40;

type Picker = ReturnType<typeof useMemberPicker>;

interface ChatTarget {
  phase: NewChatPhase;
  openLine: () => Promise<string | null>;
  settle: () => void;
}

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
  if (only === undefined) return (await createGroup(members.map(m => m.address), name)).line;
  const res = await resolveDmConvId(only.address);
  if ('convId' in res) return lineOfConv(res.convId);
  throw new Error(resolveErrorMessage(res.error, res.detail));
}

function useChatTarget(members: Member[], name: string): ChatTarget {
  const [phase, setPhase] = useState<NewChatPhase>('idle');
  const opened = useRef<{ key: string; line: string } | null>(null);
  const busy = useRef(false);
  const openLine = async (): Promise<string | null> => {
    if (members.length === 0) { capabilities.toast('Pick who to send it to first'); return null; }
    if (busy.current) return null;
    const key = recipientsKey(members.map(m => m.address));
    if (opened.current?.key === key) { setPhase('sending'); return opened.current.line; }
    busy.current = true;
    setPhase('creating');
    try {
      const line = await openConversation(members, name);
      opened.current = { key, line };
      setPhase('sending');
      return line;
    } catch (err) {
      setPhase('idle');
      capabilities.toast(errorMessage(err));
      return null;
    } finally {
      busy.current = false;
    }
  };
  return { phase, openLine, settle: () => { setPhase('idle'); } };
}

function NewChatFields({ picker, name, setName, busy, onGroup, onOpen }: {
  picker: Picker; name: string; setName: (name: string) => void; busy: boolean; onGroup: () => void; onOpen: () => void;
}): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const count = picker.members.length;
  return (
    <MemberPicker state={picker} dark={dark}>
      {count > 1 ? <GroupNameField name={name} setName={setName} /> : null}
      {count > 0 ? (
        <Button size="lg" fullWidth pill dark={dark} color="secondary" variant="soft" loading={busy}
          label={openChatLabel(count)} onPress={onOpen} />
      ) : null}
      {count === 0 && picker.entry.trim() === '' ? (
        <Box margin={{ x: -MODAL.padding }}><NewGroupRow onPress={onGroup} /></Box>
      ) : null}
    </MemberPicker>
  );
}

function NewChatComposer({ members, target, onPosted }: {
  members: Member[]; target: ChatTarget; onPosted: (line: string) => void;
}): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const note = phaseNote(target.phase);
  return (
    <Col>
      {note === null ? null : (
        <Box padding={{ x: PAGE_GUTTER, bottom: 8 }}><Text value={note} size="sm" role="secondary" /></Box>
      )}
      <MessengerComposer
        dark={dark}
        openLine={target.openLine}
        canSend={members.length > 0}
        mentionCandidates={members.map(m => ({ address: m.address, name: m.label }))}
        suggestContacts
        onPosted={onPosted}
        onSent={(_localId, error) => { if (error !== undefined) target.settle(); }}
      />
    </Col>
  );
}

function NewChatSheet({ onClose }: { onClose: () => void }): React.ReactElement {
  const router = useRouter();
  const [step, setStep] = useState<'chat' | 'group'>('chat');
  const picker = useMemberPicker();
  const [name, setName] = useState('');
  const target = useChatTarget(picker.members, name);
  const openChat = (line: string): void => {
    const convId = convIdOfLine(line);
    onClose();
    if (convId !== null) router.push({ pathname: '/channel/[convId]', params: { convId } });
  };
  const openWithoutMessage = (): void => {
    const only = picker.members.length === 1 ? picker.members[0] : undefined;
    if (only === undefined) { void target.openLine().then(line => { if (line !== null) openChat(line); }); return; }
    onClose();
    router.push({ pathname: '/[convId]', params: { convId: only.address } });
  };
  const chat = step === 'chat';
  return (
    <AppModal visible onClose={onClose} title={chat ? 'New chat' : 'New group'}
      footer={chat ? <NewChatComposer members={picker.members} target={target} onPosted={openChat} /> : undefined}>
      {chat ? (
        <NewChatFields picker={picker} name={name} setName={setName} busy={target.phase === 'creating'}
          onGroup={() => { setStep('group'); }} onOpen={openWithoutMessage} />
      ) : <NewGroupForm onDone={onClose} />}
    </AppModal>
  );
}

export function NewChatModal({ visible, onClose }: { visible: boolean; onClose: () => void }): React.ReactElement | null {
  return visible ? <NewChatSheet onClose={onClose} /> : null;
}
