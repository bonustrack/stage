/** @file Settings → Kit route hosting the @stage-labs/kit component gallery and theme color editor. */

import { useLayoutEffect } from 'react';
import { useNavigation } from 'expo-router';
import { KitPage } from '../../components/system/KitPage';

/** Settings → Kit screen: the @stage-labs/kit component gallery + theme color editor. */
export default function SettingsKitRoute(): React.ReactElement {
  /** Disable the app's full-width swipe-back gesture here so it stops starving the gallery ScrollView's vertical pans; the header back arrow still pops the route. */
  const navigation = useNavigation();
  useLayoutEffect(() => {
    navigation.setOptions({ gestureEnabled: false });
  }, [navigation]);

  return <KitPage />;
}
