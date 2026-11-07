import { usePalette } from '../lib/theme';
import { Column } from './layout';

type Width = number | `${number}%`;

export function PlaceholderBar({
  width,
  height,
  line,
  background,
}: {
  width: Width;
  height: number;
  line?: number;
  background?: string;
}): React.ReactElement {
  const { border } = usePalette();
  const bar = <Column width={width} height={height} radius="full" background={background ?? border} />;
  if (line === undefined) return bar;
  return (
    <Column height={line} justify="center">
      {bar}
    </Column>
  );
}
