import { ScrollView } from 'react-native-gesture-handler';
import type { ScreenScrollProps } from './ScreenScroll.types';

export function ScreenScroll({ style, ...rest }: ScreenScrollProps): React.ReactElement {
  return <ScrollView style={[{ flex: 1 }, style]} showsVerticalScrollIndicator={false} {...rest} />;
}
