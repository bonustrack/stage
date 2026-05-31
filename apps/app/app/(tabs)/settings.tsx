/** Settings route — NO LONGER in the bottom tab bar (hidden via `href: null` in
 *  `_layout.tsx`) and NO LONGER in the swipe pager strip. It's reached only from
 *  the LeftDrawer's Settings row. Since the pager doesn't mount it, this route
 *  renders the real `SettingsScreen` body itself. */

import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SettingsScreen } from '../../components/tabs/SettingsScreen';

export default function SettingsRoute(): React.ReactElement {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, paddingTop: insets.top }}>
      <SettingsScreen />
    </View>
  );
}
