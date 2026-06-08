/** Public | Private segmented pill for the Receive screen. Switches the shown
 *  address between the public EOA (0x…) and the shielded Railgun 0zk address.
 *  When the private address isn't ready yet the Private segment shows a subtle
 *  "loading…" label and is disabled so the screen never lands on a blank QR. */

import { Pressable } from '@metro-labs/kit/pressable';
import { Text } from '@metro-labs/kit/text';
import { Box } from '../layout';
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
        <Text style={{
          color: active ? head : sub, fontSize: 14,
          fontFamily: active ? 'Calibre-Semibold' : 'Calibre-Medium',
        }}>
          {label}
        </Text>
      </Pressable>
    );
  };

  return (
    <Box style={{
      flexDirection: 'row', width: '100%', padding: 3, gap: 3,
      borderRadius: 12, borderWidth: 1, borderColor: border,
    }}>
      {segment('public', 'Public', false)}
      {segment('private', privateReady ? 'Private' : 'Private (loading…)', !privateReady)}
    </Box>
  );
}
