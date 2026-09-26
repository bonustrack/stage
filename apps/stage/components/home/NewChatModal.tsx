import { useEffect, useState } from 'react';
import { ListViewItem } from '@stage-labs/kit/react-native/list-view';
import { Glyph } from '@stage-labs/kit/react-native/glyph';
import { Text } from '@stage-labs/kit/react-native/text';
import { AppModal } from '../AppModal';
import { MODAL } from '@stage-labs/kit/react-native/modal';
import { FormField } from '../FormField';
import { Box, Col } from '../layout';
import { HomeContactResults } from './contacts';
import { NewGroupForm } from '../group/NewGroupForm';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { IconUserGroup } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconUserGroup';

const ACTION_ICON_SIZE = 40;

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

function NewChatForm({ onGroup, onDone }: { onGroup: () => void; onDone: () => void }): React.ReactElement {
  const [query, setQuery] = useState('');
  return (
    <Col gap={12}>
      <FormField label="Search" placeholder="Name, address or @username" value={query} onChangeText={setQuery}
        inputProps={{ autoFocus: true, autoCapitalize: 'none', autoCorrect: false }} />
      <Box margin={{ x: -MODAL.padding }}>
        {query.trim() === '' ? <NewGroupRow onPress={onGroup} /> : null}
        <HomeContactResults query={query} noChannels showAllWhenEmpty onOpen={onDone} />
      </Box>
    </Col>
  );
}

export function NewChatModal({ visible, onClose }: { visible: boolean; onClose: () => void }): React.ReactElement {
  const [step, setStep] = useState<'chat' | 'group'>('chat');
  useEffect(() => { if (!visible) setStep('chat'); }, [visible]);
  return (
    <AppModal visible={visible} onClose={onClose} title={step === 'chat' ? 'New chat' : 'New group'}>
      {visible && step === 'chat' ? <NewChatForm onGroup={() => { setStep('group'); }} onDone={onClose} /> : null}
      {visible && step === 'group' ? <NewGroupForm onDone={onClose} /> : null}
    </AppModal>
  );
}
