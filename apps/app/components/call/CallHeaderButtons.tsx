/** CallHeaderButtons — the voice + video call entry buttons for a 1:1
 *  conversation header. Wraps CallController (which owns the call state machine
 *  + renders the incoming sheet / in-call screen) and renders the two header
 *  Pressables, gated on the native WebRTC module being present (a dev/preview
 *  APK). Extracted from app/xmtp/[convId].tsx to keep that route under the
 *  file-size lint. */

import { Pressable } from 'react-native';
import { Icon } from '@metro-labs/kit/icon';
import { CallController } from './CallController';

export interface CallHeaderButtonsProps {
  /** Account-scoped conversation line (metro://xmtp/<account>/<conv>). */
  line: string;
  peerName: string;
  /** Icon tint (header foreground token). */
  color: string;
}

export function CallHeaderButtons({ line, peerName, color }: CallHeaderButtonsProps): React.ReactElement {
  return (
    <CallController line={line} peerName={peerName}>
      {({ available, startVoice, startVideo }) => (available ? (
        <>
          <Pressable onPress={startVoice} hitSlop={8} style={{ paddingHorizontal: 8, justifyContent: 'center' }}>
            <Icon name="phone" size={22} color={color} />
          </Pressable>
          <Pressable onPress={startVideo} hitSlop={8} style={{ paddingHorizontal: 8, justifyContent: 'center' }}>
            <Icon name="videoCamera" size={22} color={color} />
          </Pressable>
        </>
      ) : null)}
    </CallController>
  );
}
