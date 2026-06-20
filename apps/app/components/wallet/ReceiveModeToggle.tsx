/** @file Public | Private segmented pill for the Receive screen that toggles the shown address between the public EOA and the shielded Railgun 0zk address, disabling Private until it is ready. */

import { Pressable } from '@stage-labs/kit/pressable';

import { Text } from '@stage-labs/kit/text';
import { Row } from '../layout';
import { usePalette } from '../../lib/theme';

export type ReceiveMode = 'public' | 'private';

/** Toggle for switching the receive screen between public and private modes. */
export function ReceiveModeToggle({ mode, onChange, privateReady }: {
  mode: ReceiveMode;
  onChange: (m: ReceiveMode) => void;
  privateReady: boolean;
}): React.ReactElement {
  const { link: head, text: sub, border } = usePalette();
  const rowBg = border;
  /** Segment helper. */
  const segment = (value: ReceiveMode, label: string, disabled: boolean): React.ReactElement => {
    const active = mode === value;
    return (
      <Pressable
        key={value}
        onPress={() => { if (!disabled) onChange(value); }}
        disabled={disabled}
        style={{
          flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: 'center',
          backgroundColor: active ? rowBg : 'transparent',
          opacity: disabled ? 0.45 : 1,
        }}
>
        <Text size="3xl" weight={active ? 'semibold' : 'normal'} color={active ? head : sub}>
          {label}
        </Text>
      </Pressable>
    );
  };

  return (
    <Row width={'100%'} radius="lg" padding={3} gap={3} style={{ borderWidth: 1, borderColor: border }}>
      {segment('public', 'Public', false)}
      {segment('private', privateReady ? 'Private' : 'Private (loading…)', !privateReady)}
    </Row>
  );
}
