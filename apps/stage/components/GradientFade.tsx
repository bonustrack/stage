import { useId } from 'react';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

export function GradientFade({ color, height, solid }: {
  color: string; height: number; solid: 'top' | 'bottom';
}): React.ReactElement {
  const id = `fade${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const top = solid === 'top' ? 1 : 0;
  return (
    <Svg width="100%" height={height}>
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity={top}/>
          <Stop offset="1" stopColor={color} stopOpacity={1 - top}/>
        </LinearGradient>
      </Defs>
      <Rect width="100%" height={height} fill={`url(#${id})`}/>
    </Svg>
  );
}
