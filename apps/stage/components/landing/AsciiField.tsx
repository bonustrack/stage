import { useMemo } from 'react';
import Svg, { Path } from 'react-native-svg';
import { Box } from '../layout';
import { HERO_BLACK, asciiPath } from './Landing.model';
import { useAsciiArt } from './useAsciiArt';

export function AsciiField({ width, height }: { width: number; height: number }): React.ReactElement {
  const art = useAsciiArt(width, height);
  const d = useMemo(() => asciiPath(art, width, height), [art, width, height]);
  return (
    <Box pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, width, height, overflow: 'hidden' }}>
      <Svg width={width} height={height}>
        <Path d={d} fill={HERO_BLACK} />
      </Svg>
    </Box>
  );
}
