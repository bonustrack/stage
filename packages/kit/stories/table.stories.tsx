import type { Story } from '../gallery/story';
import { Table, type TableCellProps } from '../src/react-native/table';
import { Text } from '../src/react-native/text';
import { number, select, useDark } from './_controls';

export default { title: 'Table' };

const ROWS = [['Alice', 'Design', '12'], ['Bob', 'Engineering', '7'], ['Chloé', 'Research', '31']];

export const Controls: Story<Pick<TableCellProps, 'align' | 'vAlign' | 'padding'>> = (args) => {
  const dark = useDark();
  return (
    <Table dark={dark}>
      <Table.Row header dark={dark}>
        {['Name', 'Team', 'Items'].map((h) => <Table.Cell key={h} {...args}><Text weight="semibold">{h}</Text></Table.Cell>)}
      </Table.Row>
      {ROWS.map((r) => (
        <Table.Row key={r[0]} dark={dark}>
          {r.map((c) => <Table.Cell key={c} {...args}><Text>{c}</Text></Table.Cell>)}
        </Table.Row>
      ))}
    </Table>
  );
};
Controls.args = { align: 'start', vAlign: 'center', padding: 8 };
Controls.argTypes = { align: select(['start', 'center', 'end']), vAlign: select(['start', 'center', 'end']), padding: number };
