/** Public | Private segmented pill for the Receive screen. Switches the shown
 *  address between the public EOA (0x…) and the shielded Railgun 0zk address.
 *  When the private address isn't ready yet the Private segment shows a subtle
 *  "loading…" label and is disabled so the screen never lands on a blank QR. */

import { Pressable } from '@metro-labs/kit/pressable';

import { Text } from '@metro-labs/kit/text';
import { Row } from '../layout';
import { usePalette } from '../../lib/theme';

export type ReceiveMode = 'public' | 'private';

export function ReceiveModeToggle({ mode, onChange, privateReady }: {
  mode: ReceiveMode;
  onChange: (m: ReceiveMode) => void;
  privateReady: boolean;
}): React.ReactElement {
  const { link: head, text: sub, border } = usePalette();
  const rowBg = border;
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
        <Text size="md" weight={active ? 'semibold' : 'normal'} color={active ? head : sub}>
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
