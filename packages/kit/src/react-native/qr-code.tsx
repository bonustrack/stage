
import { View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { buildQrMatrix } from '../kit/qr';

export interface QrCodeProps {
  value: string;
  size?: number;
  color?: string;
  background?: string;
}

export function QrCode(props: QrCodeProps): React.ReactElement {
  const { value, size = 160, color = '#000000', background = '#ffffff' } = props;
  const matrix = buildQrMatrix(value, size);
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Rect x={0} y={0} width={size} height={size} fill={background} />
        <Path d={matrix.path} fill={color} />
      </Svg>
    </View>
  );
}
