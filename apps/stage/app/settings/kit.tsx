
import { useLayoutEffect } from 'react';
import { useNavigation } from 'expo-router';
import { KitPage } from '../../components/system/KitPage';

export default function SettingsKitRoute(): React.ReactElement {
  const navigation = useNavigation();
  useLayoutEffect(() => {
    navigation.setOptions({ gestureEnabled: false });
  }, [navigation]);

  return <KitPage />;
}
