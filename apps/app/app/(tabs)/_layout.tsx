/** Bottom tab bar — Home / Search / Lines / Settings / Messenger. */

import { Tabs } from 'expo-router';
import { useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HeroIcon, type HeroIconName } from '../../components/HeroIcon';

export default function TabsLayout(): React.ReactElement {
  const dark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const bg = dark ? '#000000' : '#ffffff';
  const border = dark ? '#1f2630' : '#e5e9f0';
  const active = dark ? '#ffffff' : '#1a1f29';
  const inactive = dark ? '#8a94a6' : '#5a6477';

  const tabBarStyle = {
    backgroundColor: bg,
    borderTopColor: border,
    height: 60 + insets.bottom,
    paddingTop: 6,
    paddingBottom: insets.bottom,
  };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        /** No nav header → reserve status-bar space here so screens don't need to. */
        sceneStyle: { backgroundColor: bg, paddingTop: insets.top },
        tabBarStyle,
        tabBarActiveTintColor: active,
        tabBarInactiveTintColor: inactive,
        tabBarShowLabel: false,
      }}
    >
      {(
        [
          ['index', 'home'],
          ['search', 'search'],
          ['lines', 'list'],
          ['settings', 'cog'],
          ['messenger', 'send'],
        ] as const satisfies ReadonlyArray<readonly [string, HeroIconName]>
      ).map(([name, icon]) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            tabBarStyle,
            tabBarIcon: ({ color, focused }) => (
              <HeroIcon name={icon} size={26} color={color} focused={focused} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
