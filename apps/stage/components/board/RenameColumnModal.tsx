import { useState } from 'react';
import { Button } from '@stage-labs/kit/react-native/button';
import { Text } from '@stage-labs/kit/react-native/text';
import type { ChannelListRow } from '@stage-labs/client/xmtp/channelsFilter';
import type { LabelEntry } from '@stage-labs/client/xmtp/labelRegistry';
import { AppModal } from '../AppModal';
import { FormField } from '../FormField';
import { Box, Col } from '../layout';
import { reported } from '../../lib/errorPolicy';
import { useEffectiveColorScheme } from '../../lib/theme';
import { renameProblem } from './BoardScreen.model';
import { renameBoardLabel } from './boardActions';

function RenameColumnForm({ entry, entries, rows, onDone }: {
  entry: LabelEntry; entries: readonly LabelEntry[]; rows: readonly ChannelListRow[]; onDone: () => void;
}): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const [name, setName] = useState(entry.name);
  const problem = renameProblem(entries, entry, name);
  const disabled = problem !== null || name.trim() === entry.name;
  const save = (): void => {
    if (disabled) return;
    void renameBoardLabel(rows, entry, name).catch(reported('board.rename'));
    onDone();
  };
  return (
    <Col gap={8}>
      <FormField label="Name" placeholder="Column name" value={name} onChangeText={setName} onSubmit={save}
        inputProps={{ autoFocus: true }}/>
      {problem === null ? null : <Text value={problem} size="md" color="secondary"/>}
      <Box padding={{ top: 8 }}>
        <Button label="Save" block size="lg" color="primary" variant="solid" dark={dark} disabled={disabled} onPress={save}/>
      </Box>
    </Col>
  );
}

export function RenameColumnModal({ entry, entries, rows, onClose }: {
  entry: LabelEntry | null; entries: readonly LabelEntry[]; rows: readonly ChannelListRow[]; onClose: () => void;
}): React.ReactElement {
  return (
    <AppModal visible={entry !== null} onClose={onClose} title="Rename column">
      {entry === null ? null : <RenameColumnForm entry={entry} entries={entries} rows={rows} onDone={onClose}/>}
    </AppModal>
  );
}
