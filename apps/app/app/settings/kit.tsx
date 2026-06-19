/** @file Settings → Kit route hosting the @metro-labs/kit component gallery and theme color editor. */

import { useLayoutEffect } from 'react';
import { useNavigation } from 'expo-router';
import { KitPage } from '../../components/system/KitPage';

/** Settings → Kit screen: the @metro-labs/kit component gallery + theme color editor. */
export default function SettingsKitRoute(): React.ReactElement {
  /**
   * Disable the app's full-width swipe-back (the JS card stack's interactive
   *  horizontal pan, armed from anywhere via gestureResponseDistance:9999 in
   *  _layout). On this page it captured vertical pans and starved the gallery's
   *  ScrollView, so the page wouldn't scroll. The header back arrow still pops
   *  the route, so losing the gesture here is fine.
   */
  const navigation = useNavigation();
  useLayoutEffect(() => {
    navigation.setOptions({ gestureEnabled: false });
  }, [navigation]);

  return <KitPage />;
}
