import { View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { buildQrMatrix } from '../qr';
import { accessibilityProps, weightStyle, type A2uiCommonProps } from './a2ui-props';

export interface QrCodeProps extends A2uiCommonProps {
  value: string;
  size?: number;
  color?: string;
  background?: string;
}

export function QrCode(props: QrCodeProps): React.ReactElement {
  const { value, size = 160, color = '#000000', background = '#ffffff', weight, accessibility } = props;
  const matrix = buildQrMatrix(value, size);
  return (
    <View {...accessibilityProps(accessibility)} style={{ width: size, height: size, ...weightStyle(weight) }}>
      <Svg width={size} height={size}>
        <Rect x={0} y={0} width={size} height={size} fill={background} />
        <Path d={matrix.path} fill={color} />
      </Svg>
    </View>
  );
}
