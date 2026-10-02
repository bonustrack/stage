import { RTCView } from 'react-native-webrtc';
import type { CallMediaViewProps } from './CallScreen.model';

export function CallMediaView({ stream, kind, mirrored = false, contain = false }: CallMediaViewProps): React.ReactElement | null {
  if (kind === 'audio' || stream?.platform !== 'native') return null;
  return <RTCView streamURL={stream.value.toURL()} mirror={mirrored} objectFit={contain ? 'contain' : 'cover'} style={{ width: '100%', height: '100%' }}/>;
}
