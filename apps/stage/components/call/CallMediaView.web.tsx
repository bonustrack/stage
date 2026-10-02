import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { ignore } from '../../lib/errorPolicy';
import type { CallMediaViewProps } from './CallScreen.model';

function mediaElement(kind: CallMediaViewProps['kind'], mirrored: boolean, contain: boolean): HTMLMediaElement {
  const el = document.createElement(kind);
  el.autoplay = true;
  if (el instanceof HTMLVideoElement) {
    el.muted = true;
    el.playsInline = true;
    el.style.width = '100%';
    el.style.height = '100%';
    el.style.objectFit = contain ? 'contain' : 'cover';
    el.style.transform = mirrored ? 'scaleX(-1)' : 'none';
  }
  return el;
}

export function CallMediaView({ stream, kind, mirrored = false, contain = false }: CallMediaViewProps): React.ReactElement {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (host === null || stream?.platform !== 'web') return;
    const el = mediaElement(kind, mirrored, contain);
    el.srcObject = stream.value;
    host.appendChild(el);
    ignore(el.play(), 'ui');
    return () => {
      el.srcObject = null;
      el.remove();
    };
  }, [host, stream, kind, mirrored, contain]);
  return (
    <View
      ref={(node) => { setHost(node as unknown as HTMLElement | null); }}
      style={kind === 'audio' ? { display: 'none' } : { width: '100%', height: '100%' }}
    />
  );
}
