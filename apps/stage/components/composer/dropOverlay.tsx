import { Glyph } from '@stage-labs/kit/react-native/glyph';
import { Text } from '@stage-labs/kit/react-native/text';
import { Row } from '../layout';
import { IconPaperclip3 } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconPaperclip3';

export function DropOverlay({ head }: { head: string }): React.ReactElement {
  const edge = { width: 2, color: head, style: 'dashed' };
  return (
    <Row
      pointerEvents="none"
      surface="surface"
      align="center"
      justify="center"
      gap={8}
      radius="lg"
      border={{ top: edge, right: edge, bottom: edge, left: edge }}
      style={{ position: 'absolute', top: 6, right: 6, bottom: 6, left: 6 }}
    >
      <Glyph icon={IconPaperclip3} size={20} color={head}/>
      <Text weight="semibold" size="md" color={head}>Drop files to attach</Text>
    </Row>
  );
}
