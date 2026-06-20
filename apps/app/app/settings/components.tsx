/** @file Settings → Components route hosting the app-level UI component showcase and theme switcher. */

import { useLayoutEffect } from 'react';
import { useNavigation } from 'expo-router';
import { ComponentsPage } from '../../components/system/ComponentsPage';

/** Settings → Components screen: the app-level UI component showcase + theme switcher. */
export default function SettingsComponentsRoute(): React.ReactElement {
  /** Disable the app's full-width swipe-back here: it captured vertical pans and starved the showcase ScrollView; the header back arrow still pops the route. */
  const navigation = useNavigation();
  useLayoutEffect(() => {
    navigation.setOptions({ gestureEnabled: false });
  }, [navigation]);

  return <ComponentsPage />;
}
