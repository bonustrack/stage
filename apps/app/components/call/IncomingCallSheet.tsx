/** IncomingCallSheet — the bottom-sheet that rings when a peer invites you to a
 *  call (phase === 'ringing'). Shows who is calling + the offered media, with
 *  Accept / Decline. Accept hands off to CallScreen (phase advances to
 *  connecting); Decline sends a reject and tears down.
 *
 *  Built on the app's shared AppModal + Kit primitives. */

import { Button } from '@metro-labs/kit/button';
import { Icon } from '@metro-labs/kit/icon';
import { Text } from '@metro-labs/kit/text';
import { AppModal } from '../AppModal';
import { Box, Row } from '../layout';
import { usePalette } from '../../lib/theme';
import type { CallState } from '../../lib/useCall';

export interface IncomingCallSheetProps {
  state: CallState;
  peerName: string;
  onAccept: () => void;
  onReject: () => void;
}

export function IncomingCallSheet({
  state, peerName, onAccept, onReject,
}: IncomingCallSheetProps): React.ReactElement | null {
  const pal = usePalette();
  const ringing = state.phase === 'ringing';
  const isVideo = state.media.video;

  return (
    <AppModal visible={ringing} onClose={onReject}>
      <Box padding={{ x: 20, y: 8 }} gap={20} align="center">
        <Icon name={isVideo ? 'videoCamera' : 'phoneIncoming'} size={40} color={pal.primary} />
        <Box gap={4} align="center">
          <Text size="5xl" weight="semibold" color={pal.text}>{peerName}</Text>
          <Text size="md" color={pal.border}>
            {isVideo ? 'Incoming video call' : 'Incoming voice call'}
          </Text>
        </Box>
        <Row gap={16} align="center" justify="center">
          <Button size="lg" tintBg={pal.danger} tintFg="#ffffff" label="Decline" onPress={onReject} />
          <Button size="lg" variant="primary" label="Accept" onPress={onAccept} />
        </Row>
      </Box>
    </AppModal>
  );
}
