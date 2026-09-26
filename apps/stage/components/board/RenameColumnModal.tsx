import { useState } from 'react';
import { Button } from '@stage-labs/kit/react-native/button';
import { Text } from '@stage-labs/kit/react-native/text';
import type { ChannelListRow } from '@stage-labs/client/xmtp/channelsFilter';
import { AppModal } from '../AppModal';
import { FormField } from '../FormField';
import { Box, Col } from '../layout';
import { reported } from '../../lib/errorPolicy';
import { useEffectiveColorScheme } from '../../lib/theme';
import { renameProblem, renameTarget, type BoardColumn } from './BoardScreen.model';
import { renameBoardLabel } from './boardActions';

interface RenameProps {
  columns: readonly BoardColumn<unknown>[];
  rows: readonly ChannelListRow[];
  saved: readonly string[];
}

function RenameColumnForm({ label, columns, rows, saved, onDone }: RenameProps & {
  label: string; onDone: () => void;
}): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const [name, setName] = useState(label);
  const problem = renameProblem(name);
  const target = renameTarget(columns, label, name);
  const note = target.merge ? `Channels move into the ${target.name} column.` : problem;
  const disabled = problem !== null || target.name === label;
  const save = (): void => {
    if (disabled) return;
    void renameBoardLabel(rows, columns, saved, label, target.name).catch(reported('board.rename'));
    onDone();
  };
  return (
    <Col gap={8}>
      <FormField label="Name" placeholder="Column name" value={name} onChangeText={setName} onSubmit={save}
        inputProps={{ autoFocus: true }}/>
      {note === null ? null : <Text value={note} size="md" color="secondary"/>}
      <Box padding={{ top: 8 }}>
        <Button label="Save" block size="lg" color="primary" variant="solid" dark={dark} disabled={disabled} onPress={save}/>
      </Box>
    </Col>
  );
}

export function RenameColumnModal({ label, onClose, ...props }: RenameProps & {
  label: string | null; onClose: () => void;
}): React.ReactElement {
  return (
    <AppModal visible={label !== null} onClose={onClose} title="Rename column">
      {label === null ? null : <RenameColumnForm label={label} onDone={onClose} {...props}/>}
    </AppModal>
  );
}
