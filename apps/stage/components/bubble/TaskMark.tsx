import { Glyph } from '@stage-labs/kit/react-native/glyph';
import { IconSquareCheck } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconSquareCheck';
import { IconSquarePlaceholder } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconSquarePlaceholder';
import { Box } from '../layout';
import { usePalette } from '../../lib/theme';
import type { TaskState } from './markdown.model';

const LINE_HEIGHT = 23;

export function TaskMark({ task }: { task: TaskState }): React.ReactElement {
  const pal = usePalette();
  const done = task === 'done';
  return (
    <Box
      justify="center" height={LINE_HEIGHT} margin={{ left: 2, right: 8 }}
      accessibilityRole="checkbox" accessibilityState={{ checked: done }}
    >
      <Glyph icon={done ? IconSquareCheck : IconSquarePlaceholder} size={18} color={done ? pal.text : pal.sub}/>
    </Box>
  );
}
