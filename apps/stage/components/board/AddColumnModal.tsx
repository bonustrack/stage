import { useState } from 'react';
import { Button } from '@stage-labs/kit/react-native/button';
import { Text } from '@stage-labs/kit/react-native/text';
import { AppModal } from '../AppModal';
import { FormField } from '../FormField';
import { Box, Col } from '../layout';
import { useEffectiveColorScheme } from '../../lib/theme';
import { addColumnProblem, type BoardColumn } from './BoardScreen.model';
import { addBoardColumn } from './boardActions';

interface AddColumnProps {
  columns: readonly BoardColumn<unknown>[];
  saved: readonly string[];
  onAdded: () => void;
}

function AddColumnForm({ columns, saved, onAdded, onDone }: AddColumnProps & { onDone: () => void }): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const [name, setName] = useState('');
  const [tried, setTried] = useState(false);
  const problem = addColumnProblem(columns, name);
  const note = name === '' && !tried ? null : problem;
  const save = (): void => {
    setTried(true);
    if (problem !== null) return;
    addBoardColumn(columns, saved, name);
    onAdded();
    onDone();
  };
  return (
    <Col gap={8}>
      <FormField label="Name" placeholder="Column name" value={name} onChangeText={setName} onSubmit={save}
        inputProps={{ autoFocus: true }}/>
      {note === null ? null : <Text value={note} size="md" color="secondary"/>}
      <Box padding={{ top: 8 }}>
        <Button label="Add" block size="lg" color="primary" variant="solid" dark={dark} disabled={problem !== null}
          onPress={save}/>
      </Box>
    </Col>
  );
}

export function AddColumnModal({ visible, onClose, ...props }: AddColumnProps & {
  visible: boolean; onClose: () => void;
}): React.ReactElement {
  return (
    <AppModal visible={visible} onClose={onClose} title="Add column">
      {visible ? <AddColumnForm onDone={onClose} {...props}/> : null}
    </AppModal>
  );
}
