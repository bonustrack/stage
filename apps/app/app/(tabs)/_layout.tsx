/** Bottom tab bar — Home, Search, Settings. X-style: icons + labels, active in accent color. */

import { Tabs } from 'expo-router';
import { useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HeroIcon, type HeroIconName } from '../../components/HeroIcon';

export default function TabsLayout(): React.ReactElement {
  const dark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const bg = dark ? '#0f1115' : '#ffffff';
  const border = dark ? '#1f2630' : '#e5e9f0';
  const active = '#4f8cff';
  const inactive = dark ? '#8a94a6' : '#5a6477';

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: bg },
        headerTintColor: dark ? '#e8ecf2' : '#1a1f29',
        headerTitleStyle: { fontFamily: 'Calibre-Semibold' },
        sceneStyle: { backgroundColor: bg },
        tabBarStyle: {
          backgroundColor: bg,
          borderTopColor: border,
          height: 60 + insets.bottom,
          paddingTop: 6,
          paddingBottom: insets.bottom,
        },
        tabBarActiveTintColor: active,
        tabBarInactiveTintColor: inactive,
        tabBarLabelStyle: { fontFamily: 'Calibre-Semibold', fontSize: 11 },
      }}
    >
      {(
        [
          ['index', 'Home', 'home'],
          ['messenger', 'Messenger', 'send'],
          ['search', 'Search', 'search'],
          ['lines', 'Lines', 'chat'],
          ['settings', 'Settings', 'cog'],
        ] as const satisfies ReadonlyArray<readonly [string, string, HeroIconName]>
      ).map(([name, title, icon]) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title,
            tabBarIcon: ({ color, focused }) => (
              <HeroIcon name={icon} size={26} color={color} focused={focused} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
