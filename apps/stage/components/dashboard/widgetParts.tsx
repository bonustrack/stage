import { Text } from '@stage-labs/kit/react-native/text';
import { BLOCK_RADIUS_DEFAULT } from '@stage-labs/kit/tokens';
import { usePalette } from '../../lib/theme';
import { Column } from '../layout';

const OUTLINE_PADDING = 12;

export type WidgetGrip = (handle: React.ReactElement) => React.ReactElement;

export function Unavailable({ title, detail }: { title: string; detail?: string }): React.ReactElement {
  const { border } = usePalette();
  const edge = { width: 1, color: border, style: 'dashed' };
  return (
    <Column
      weight={1}
      gap={4}
      padding={OUTLINE_PADDING}
      radius={BLOCK_RADIUS_DEFAULT}
      border={{ top: edge, right: edge, bottom: edge, left: edge }}
      align="center"
      justify="center"
    >
      <Text text={title} size="xs" fontWeight="semibold" color="link" textAlign="center" maxLines={2} />
      {detail === undefined ? null : <Text text={detail} size="2xs" color="secondary" textAlign="center" maxLines={3} />}
    </Column>
  );
}
