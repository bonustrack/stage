import { useMemo } from 'react';
import Svg, { Path } from 'react-native-svg';
import { HERO_BLACK, asciiPath } from './Landing.model';
import { useAsciiArt } from './useAsciiArt';
import { Column } from '../layout';

export function AsciiField({ width, height }: { width: number; height: number }): React.ReactElement {
  const art = useAsciiArt(width, height);
  const d = useMemo(() => asciiPath(art, width, height), [art, width, height]);
  return (
    <Column pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, width, height, overflow: 'hidden' }}>
      <Svg width={width} height={height}>
        <Path d={d} fill={HERO_BLACK} />
      </Svg>
    </Column>
  );
}
