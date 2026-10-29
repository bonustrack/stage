import { useState } from 'react';
import { FlatList } from 'react-native';
import type { Story } from '../gallery/story';
import { Badge } from '../src/react-native/badge';
import { Card } from '../src/react-native/card';
import { Column } from '../src/react-native/column';
import { Icon } from '../src/react-native/icon';
import { Row } from '../src/react-native/row';
import {
  SortableHandle,
  SortableItem,
  SortableList,
  SortableScope,
  type SortDirection,
  type SortIndicator,
  type SortMove,
} from '../src/react-native/sortable';
import { Text } from '../src/react-native/text';
import { bool, select, useDark } from './_controls';

export default { title: 'Sortable' };

function moved(ids: readonly string[], move: SortMove): string[] {
  const rest = ids.filter((id) => id !== move.itemId);
  return [...rest.slice(0, move.toIndex), move.itemId, ...rest.slice(move.toIndex)];
}

function MoveLog({ move }: { move: SortMove | null }): React.ReactElement {
  return (
    <Text
      size="2xs"
      fontFamily="mono"
      color="secondary"
      text={move === null ? 'Drag an item, or focus it and press Space.' : JSON.stringify(move)}
    />
  );
}

interface ControlsArgs {
  direction: SortDirection;
  indicator: SortIndicator;
  keyboard: boolean;
  disabled: boolean;
}

export const Controls: Story<ControlsArgs> = ({ direction, indicator, keyboard, disabled }) => {
  const dark = useDark();
  const [ids, setIds] = useState(['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon']);
  const [last, setLast] = useState<SortMove | null>(null);
  return (
    <Column gap={16}>
      <SortableList
        listId="greek"
        itemIds={ids}
        direction={direction}
        indicator={indicator}
        gap={8}
        label="Greek letters"
        keyboard={keyboard}
        disabled={disabled}
        onMove={(move) => {
          setIds(moved(ids, move));
          setLast(move);
        }}
      >
        {ids.map((id) => (
          <SortableItem key={id} itemId={id}>
            <Badge dark={dark} label={id} size="lg" pill />
          </SortableItem>
        ))}
      </SortableList>
      <MoveLog move={last} />
    </Column>
  );
};
Controls.args = { direction: 'vertical', indicator: 'preview', keyboard: true, disabled: false };
Controls.argTypes = {
  direction: select(['vertical', 'horizontal']),
  indicator: select(['preview', 'line', 'none', 'shift', 'follow']),
  keyboard: bool,
  disabled: bool,
};

type Lanes = Record<string, string[]>;

const LANES: Lanes = { todo: ['Write spec', 'Design', 'Review'], doing: ['Build'], done: ['Kickoff'] };

function movedAcross(lanes: Lanes, move: SortMove): Lanes {
  const from = (lanes[move.fromListId] ?? []).filter((id) => id !== move.itemId);
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
              <Text size="xs" fontWeight="semibold" text={lane} />
              <SortableList
                listId={lane}
                group="lanes"
                itemIds={ids}
                gap={8}
                label={lane}
                style={{ minHeight: 120 }}
                onMove={(move) => {
                  setLanes((current) => movedAcross(current, move));
                  setLast(move);
                }}
              >
                {ids.map((id) => (
                  <SortableItem key={id} itemId={id}>
                    <Card size="sm">
                      <Text text={id} />
                    </Card>
                  </SortableItem>
                ))}
              </SortableList>
            </Column>
          ))}
        </Row>
        <MoveLog move={last} />
      </Column>
    </SortableScope>
  );
};

export const Handle: Story = () => {
  const [ids, setIds] = useState(['Inbox', 'Projects', 'Archive']);
  return (
    <SortableList
      listId="folders"
      itemIds={ids}
      gap={8}
      onMove={(move) => {
        setIds(moved(ids, move));
      }}
    >
      {ids.map((id) => (
        <SortableItem key={id} itemId={id} handle>
          <Row gap={8} align="center">
            <SortableHandle>
              <Icon name="menu" size={18} />
            </SortableHandle>
            <Text text={id} />
          </Row>
        </SortableItem>
      ))}
    </SortableList>
  );
};

export const Shift: Story = () => {
  const dark = useDark();
  const [ids, setIds] = useState(['Inbox', 'Today', 'Upcoming', 'Someday', 'Logbook']);
  return (
    <SortableList
      listId="shift"
      itemIds={ids}
      indicator="shift"
      gap={8}
      onMove={(move) => {
        setIds(moved(ids, move));
      }}
    >
      {ids.map((id) => (
        <SortableItem key={id} itemId={id}>
          {({ dragging }) => (
            <Card size="sm" background={dragging ? 'border' : undefined}>
              <Text text={id} />
            </Card>
          )}
        </SortableItem>
      ))}
      <Badge dark={dark} label="Drag a row: the others slide to make room." size="sm" />
    </SortableList>
  );
};

const SECTIONS: Record<string, string[]> = { Work: ['Roadmap', 'Hiring'], Home: ['Groceries'], Hobbies: ['Guitar', 'Running', 'Chess'] };

export const Sections: Story = () => {
  const [order, setOrder] = useState(Object.keys(SECTIONS));
  return (
    <SortableList
      listId="sections"
      itemIds={order}
      indicator="shift"
      onMove={(move) => {
        setOrder(moved(order, move));
      }}
    >
      {order.flatMap((section) => [
        <SortableItem key={section} itemId={section}>
          <Row padding={{ y: 8 }}>
            <Text fontWeight="semibold" text={section} />
          </Row>
        </SortableItem>,
        ...(SECTIONS[section] ?? []).map((row) => (
          <SortableItem key={row} itemId={row} follows={section}>
            <Row padding={{ left: 16, y: 6 }}>
              <Text color="secondary" text={row} />
            </Row>
          </SortableItem>
        )),
      ])}
    </SortableList>
  );
};

const LONG = Array.from({ length: 200 }, (_, i) => `Row ${i + 1}`);

export const Virtualized: Story = () => {
  const [ids, setIds] = useState(LONG);
  return (
    <SortableList
      listId="long"
      itemIds={ids}
      indicator="shift"
      style={{ height: 360 }}
      onMove={(move) => {
        setIds(moved(ids, move));
      }}
    >
      <FlatList
        style={{ flex: 1 }}
        data={ids}
        keyExtractor={(id) => id}
        initialNumToRender={12}
        windowSize={3}
        renderItem={({ item }) => (
          <SortableItem itemId={item}>
            <Row padding={{ x: 12, y: 10 }}>
              <Text text={item} />
            </Row>
          </SortableItem>
        )}
      />
    </SortableList>
  );
};
