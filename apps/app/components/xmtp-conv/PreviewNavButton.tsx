/** Topnav Play button - opens the group's linked preview URL / deep link
 *  externally. Rendered only when a preview is set (caller gates on
 *  isGroup && preview). Sits AFTER the GitHub icon and BEFORE the overflow
 *  button. Linking.openURL handles http(s) + metro:// (and other) schemes. */

import { Linking, Pressable } from 'react-native';
import { Icon } from '@metro-labs/kit/icon';

export function PreviewNavButton({ url, color }: { url: string; color: string }): React.ReactElement {
  return (
    <Pressable
      onPress={() => { void Linking.openURL(url); }}
      hitSlop={8}
      style={{ paddingHorizontal: 6, justifyContent: 'center' }}
    >
      <Icon name="play" size={22} color={color} />
    </Pressable>
  );
}
