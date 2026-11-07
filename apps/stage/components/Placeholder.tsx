import { usePalette } from '../lib/theme';
import { Column } from './layout';

type Width = number | `${number}%`;

export function PlaceholderBlock({
  width,
  height,
  onCard = false,
}: {
  width: Width;
  height: number;
  onCard?: boolean;
}): React.ReactElement {
  const { border } = usePalette();
  return onCard ? (
    <Column width={width} height={height} radius="full" surface="surface" />
  ) : (
    <Column width={width} height={height} radius="full" background={border} />
  );
}

export function PlaceholderBar({
  width,
  height,
  line,
  center = false,
  onCard,
}: {
  width: Width;
  height: number;
  line?: number;
  center?: boolean;
  onCard?: boolean;
}): React.ReactElement {
  const bar = <PlaceholderBlock width={width} height={height} onCard={onCard} />;
  if (line === undefined) return bar;
  return (
    <Column height={line} justify="center" align={center ? 'center' : 'start'}>
      {bar}
    </Column>
  );
}
