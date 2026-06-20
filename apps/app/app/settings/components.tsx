
import { useLayoutEffect } from 'react';
import { useNavigation } from 'expo-router';
import { ComponentsPage } from '../../components/system/ComponentsPage';

export default function SettingsComponentsRoute(): React.ReactElement {
  const navigation = useNavigation();
  useLayoutEffect(() => {
    navigation.setOptions({ gestureEnabled: false });
  }, [navigation]);

  return <ComponentsPage />;
}
