import { Text } from '@stage-labs/kit/react-native/text';
import { Button } from '@stage-labs/kit/react-native/button';
import { ChannelRow } from '../ChannelRow';
import { MessengerComposer } from '../composer/MessengerComposer';
import type { ComposerState } from '../composer/state';
import type { ShareDestination } from './share.model';
import { useEffectiveColorScheme } from '../../lib/theme';
import { Column, Row } from '../layout';

export function ShareReview({
  destination,
  state,
  account,
  busy,
  onSubmit,
  onChoose,
}: {
  destination: ShareDestination;
  state: ComposerState;
  account: string;
  busy: boolean;
  onSubmit: () => void;
  onChoose: () => void;
}): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  return (
    <Column gap={12}>
      <Text size="xs" color="secondary">
        Account: {account}
      </Text>
      <ChannelRow
        title={destination.title}
        avatarAddress={destination.peerAddress}
        avatarUri={destination.avatarUri}
        square={destination.peerAddress === null}
        showPreview={false}
      />
      <Text size="sm" color="secondary">
        Review your files, then press Send. Your existing channel draft is unchanged.
      </Text>
      <Row>
        <Button
          dark={dark}
          label="Choose another channel"
          variant="soft"
          color="secondary"
          disabled={busy || state.recording || state.uploading}
          onPress={onChoose}
        />
      </Row>
      <MessengerComposer
        dark={dark}
        state={state}
        busy={busy}
        quickAttach={false}
        rounded
        placeholder="Add a message"
        onSubmit={onSubmit}
      />
    </Column>
  );
}
