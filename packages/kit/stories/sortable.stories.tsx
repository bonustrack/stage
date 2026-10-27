import { useState } from 'react';
import type { Story } from '../gallery/story';
import { Badge } from '../src/react-native/badge';
import { Card } from '../src/react-native/card';
import { Column } from '../src/react-native/column';
import { Icon } from '../src/react-native/icon';
import { Row } from '../src/react-native/row';
import { SortableHandle, SortableItem, SortableList, SortableScope, type SortDirection, type SortMove } from '../src/react-native/sortable';
import { Text } from '../src/react-native/text';
import { bool, select, useDark } from './_controls';

export default { title: 'Sortable' };

function moved(ids: readonly string[], move: SortMove): string[] {
  const rest = ids.filter(id => id !== move.itemId);
  return [...rest.slice(0, move.toIndex), move.itemId, ...rest.slice(move.toIndex)];
}

function MoveLog({ move }: { move: SortMove | null }): React.ReactElement {
  return <Text size="2xs" fontFamily="mono" color="secondary" text={move === null ? 'Drag an item, or focus it and press Space.' : JSON.stringify(move)}/>;
}

interface ControlsArgs { direction: SortDirection; keyboard: boolean; disabled: boolean }

export const Controls: Story<ControlsArgs> = ({ direction, keyboard, disabled }) => {
  const dark = useDark();
  const [ids, setIds] = useState(['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon']);
  const [last, setLast] = useState<SortMove | null>(null);
  return (
    <Column gap={16}>
      <SortableList
        listId="greek" itemIds={ids} direction={direction} gap={8} label="Greek letters" keyboard={keyboard} disabled={disabled}
        onMove={(move) => { setIds(moved(ids, move)); setLast(move); }}
      >
        {ids.map(id => <SortableItem key={id} itemId={id}><Badge dark={dark} label={id} size="lg" pill/></SortableItem>)}
      </SortableList>
      <MoveLog move={last}/>
    </Column>
  );
};
Controls.args = { direction: 'vertical', keyboard: true, disabled: false };
Controls.argTypes = { direction: select(['vertical', 'horizontal']), keyboard: bool, disabled: bool };

type Lanes = Record<string, string[]>;

const LANES: Lanes = { todo: ['Write spec', 'Design', 'Review'], doing: ['Build'], done: ['Kickoff'] };

function movedAcross(lanes: Lanes, move: SortMove): Lanes {
  const from = (lanes[move.fromListId] ?? []).filter(id => id !== move.itemId);
  const into = move.fromListId === move.toListId ? from : [...(lanes[move.toListId] ?? [])];
  into.splice(move.toIndex, 0, move.itemId);
  return { ...lanes, [move.fromListId]: from, [move.toListId]: into };
}

export const Lists: Story = () => {
  const [lanes, setLanes] = useState(LANES);
  const [last, setLast] = useState<SortMove | null>(null);
  return (
    <SortableScope>
      <Column gap={16}>
        <Row gap={12} align="start">
          {Object.entries(lanes).map(([lane, ids]) => (
            <Column key={lane} width={180} gap={8}>
              <Text size="xs" fontWeight="semibold" text={lane}/>
              <SortableList
                listId={lane} group="lanes" itemIds={ids} gap={8} label={lane} style={{ minHeight: 120 }}
                onMove={(move) => { setLanes(current => movedAcross(current, move)); setLast(move); }}
              >
                {ids.map(id => (
                  <SortableItem key={id} itemId={id}>
                    <Card size="sm"><Text text={id}/></Card>
                  </SortableItem>
                ))}
              </SortableList>
            </Column>
          ))}
        </Row>
        <MoveLog move={last}/>
      </Column>
    </SortableScope>
  );
};

export const Handle: Story = () => {
  const [ids, setIds] = useState(['Inbox', 'Projects', 'Archive']);
  return (
    <SortableList listId="folders" itemIds={ids} gap={8} onMove={(move) => { setIds(moved(ids, move)); }}>
      {ids.map(id => (
        <SortableItem key={id} itemId={id} handle>
          <Row gap={8} align="center">
            <SortableHandle><Icon name="menu" size={18}/></SortableHandle>
            <Text text={id}/>
          </Row>
        </SortableItem>
      ))}
    </SortableList>
  );
};
