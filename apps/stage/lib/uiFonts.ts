import { Platform } from 'react-native';
import { fontFamily } from '@stage-labs/kit/tokens';

export const MONO_FONT = Platform.select({ ios: fontFamily.mono[0], android: 'monospace', default: fontFamily.mono.join(', ') });
