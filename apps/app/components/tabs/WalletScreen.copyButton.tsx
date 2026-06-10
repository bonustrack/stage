/** Tap-to-copy icon button for the Wallet header (top-right). Sits just to the
 *  LEFT of the RefreshButton (order left→right: [copy][refresh]). A single tap
 *  copies the active public wallet address to the clipboard and flashes a brief
 *  "Address copied" toast (Android; iOS no-op per lib/toast). Matches the
 *  refresh button's size / hit-target. Rendered in the Wallet page body (the
 *  topnav is the uniform Home bar), top-right of the balance area. */

import { Pressable } from '@metro-labs/kit/pressable';
import { Icon } from '@metro-labs/kit/icon';
import * as Clipboard from 'expo-clipboard';
import { flash } from '../../lib/toast';

export function CopyButton({
  address,
  color,
}: {
  address: string | null | undefined;
  color: string;
}): React.ReactElement {
  const onCopy = (): void => {
    if (!address) return;
    void Clipboard.setStringAsync(address);
    flash('Address copied');
  };

  return (
    <Pressable
      onPress={onCopy}
      disabled={!address}
      hitSlop={10}
      style={({ pressed }) => ({
        opacity: !address ? 0.5 : pressed ? 0.5 : 1,
      })}
    >
      <Icon name="copy" size={22} color={color} />
    </Pressable>
  );
}
