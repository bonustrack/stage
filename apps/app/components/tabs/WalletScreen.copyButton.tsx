/** Tap-to-copy icon button for the Wallet header (top-right). Sits just to the
 *  LEFT of the RefreshButton (order left→right: [copy][refresh]). A single tap
 *  copies the active public wallet address to the clipboard and flashes a brief
 *  "Address copied" toast (Android; iOS no-op per lib/toast). Matches the
 *  refresh button's size / hit-target / absolute top-right anchoring — only the
 *  `right` offset is larger so the two icons sit side by side. */

import { Pressable } from '@metro-labs/kit/pressable';
import { Icon } from '@metro-labs/kit/icon';
import * as Clipboard from 'expo-clipboard';
import { flash } from '../../lib/toast';

export function CopyButton({
  address,
  color,
  top = 0,
}: {
  address: string | null | undefined;
  color: string;
  top?: number;
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
        position: 'absolute',
        top: top + 18,
        right: 16 + 22 + 12, // refresh (icon 22) + gap, so copy sits to its left
        zIndex: 20,
        opacity: !address ? 0.5 : pressed ? 0.5 : 1,
        padding: 4,
      })}
    >
      <Icon name="copy" size={22} color={color} />
    </Pressable>
  );
}
