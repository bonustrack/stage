import { useEffect, useMemo, useState } from 'react';
import { Text } from '@stage-labs/kit/react-native/text';
import { Box } from '../layout';
import {
  ASCII, HERO_BLACK, HERO_BOX_LAYERS, HERO_LAYOUT, HERO_YELLOW,
  asciiFrame, asciiGrid, heroBoxes, type HeroBox, type HeroBoxLayer,
} from './Landing.model';

interface Frame {
  width: number;
  height: number;
}

function useAsciiArt(width: number, height: number): string {
  const [time, setTime] = useState(0);
  useEffect(() => {
    const id = setInterval(() => { setTime((t) => t + ASCII.tickStep); }, ASCII.tickMs);
    return (): void => { clearInterval(id); };
  }, []);
  const { cols, rows } = asciiGrid(width, height);
  return useMemo(() => asciiFrame(cols, rows, time), [cols, rows, time]);
}

function AsciiField({ width, height }: Frame): React.ReactElement {
  const art = useAsciiArt(width, height);
  return (
    <Box
      align="center" justify="center" pointerEvents="none"
      style={{ position: 'absolute', top: 0, left: 0, width, height, overflow: 'hidden' }}
    >
      <Text
        variant="mono" color={HERO_BLACK}
        style={{ fontSize: ASCII.size, lineHeight: ASCII.lineHeight, letterSpacing: ASCII.letterSpacing }}
      >
        {art}
      </Text>
    </Box>
  );
}

function BoxLayer({ layer, width, heroHeight }: { layer: HeroBoxLayer; width: number; heroHeight: number }): React.ReactElement {
  const [boxes] = useState<HeroBox[]>(() => heroBoxes(layer.count, width, HERO_LAYOUT.boxFrameHeight, Math.random));
  return (
    <Box
      pointerEvents="none"
      style={{ position: 'absolute', left: 0, top: layer.top(heroHeight), width, height: HERO_LAYOUT.boxFrameHeight, overflow: 'hidden' }}
    >
      {boxes.map((box) => (
        <Box
          key={`${box.x}:${box.y}`} background={layer.color}
          style={{ position: 'absolute', left: box.x, top: box.y, width: box.width, height: box.height }}
        />
      ))}
    </Box>
  );
}

export function HeroBackdrop({ width, height }: Frame): React.ReactElement {
  return (
    <>
      <Box
        background={HERO_YELLOW} pointerEvents="none"
        style={{ position: 'absolute', top: 0, left: 0, width, height: HERO_LAYOUT.bandHeight }}
      />
      <AsciiField width={width} height={height} />
      {HERO_BOX_LAYERS.map((layer) => (
        <BoxLayer key={layer.color} layer={layer} width={width} heroHeight={height} />
      ))}
    </>
  );
}
