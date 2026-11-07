import { usePalette } from '../lib/theme';
import { Column } from './layout';

type Width = number | `${number}%`;

export function PlaceholderBlock({
  width,
  height,
  radius = 'full',
  onCard = false,
}: {
  width: Width;
  height: number;
  radius?: 'full' | 'md';
  onCard?: boolean;
}): React.ReactElement {
  const { border } = usePalette();
  return onCard ? (
    <Column width={width} height={height} radius={radius} surface="surface" />
  ) : (
    <Column width={width} height={height} radius={radius} background={border} />
  );
}

export function PlaceholderBar({
  width,
  height,
  line,
  onCard,
}: {
  width: Width;
  height: number;
  line?: number;
  onCard?: boolean;
}): React.ReactElement {
  const bar = <PlaceholderBlock width={width} height={height} onCard={onCard} />;
  if (line === undefined) return bar;
  return (
    <Column height={line} justify="center">
      {bar}
    </Column>
  );
}
