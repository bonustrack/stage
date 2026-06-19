/** Settings → Components route — the app-level UI component showcase (UserCard /
 *  ChannelCard / TokenCard) + a theme switcher, as its own Settings sub-page.
 *  Reached via /settings → "Components" row. */

import { useLayoutEffect } from 'react';
import { useNavigation } from 'expo-router';
import { ComponentsPage } from '../../components/system/ComponentsPage';

/** Settings → Components screen: the app-level UI component showcase + theme switcher. */
export default function SettingsComponentsRoute(): React.ReactElement {
  /** Disable the app's full-width swipe-back (the JS card stack's interactive
   *  horizontal pan, armed from anywhere via gestureResponseDistance:9999 in
   *  _layout). On this page it captured vertical pans and starved the showcase's
   *  ScrollView, so the page wouldn't scroll. The header back arrow still pops
   *  the route, so losing the gesture here is fine. */
  const navigation = useNavigation();
  useLayoutEffect(() => {
    navigation.setOptions({ gestureEnabled: false });
  }, [navigation]);

  return <ComponentsPage />;
}
