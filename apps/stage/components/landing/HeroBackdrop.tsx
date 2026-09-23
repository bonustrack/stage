import { useState } from 'react';
import { Box } from '../layout';
import { AsciiField } from './AsciiField';
import {
  HERO_BOX_LAYERS, HERO_LAYOUT, HERO_YELLOW, heroBoxes, type HeroBox, type HeroBoxLayer,
} from './Landing.model';

interface Frame {
  width: number;
  height: number;
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
