/** Bottom tab bar — Messenger (channel list) + Settings.
 *  Mirrors the minimal icon-only layout from acdee49^ — solid bg matching the
 *  active theme, no labels, status-bar inset baked into `sceneStyle.paddingTop`
 *  so individual screens don't have to reach for `useSafeAreaInsets` themselves. */

import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HeroIcon, type HeroIconName } from '../../components/HeroIcon';
import { useEffectiveColorScheme } from '../../lib/theme';

export default function TabsLayout(): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const bg = dark ? '#0e0f10' : '#ffffff';
  const border = dark ? '#282a2d' : '#e4e4e5';
  const active = dark ? '#ffffff' : '#000000';
  const inactive = dark ? '#7a7a7e' : '#8a929d';

  const tabBarStyle = {
    backgroundColor: bg,
    borderTopColor: border,
    borderTopWidth: 1,
    /** Kill Android'​s default elevation shadow on the tab bar — use only the
     *  1px top border for the separator. */
    elevation: 0,
    shadowOpacity: 0,
    height: 60 + insets.bottom,
    paddingTop: 6,
    paddingBottom: insets.bottom,
  };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: bg, paddingTop: insets.top },
        tabBarStyle,
        tabBarActiveTintColor: active,
        tabBarInactiveTintColor: inactive,
        tabBarShowLabel: false,
      }}
    >
      {(
        [
          ['index', 'send'],
          ['contacts', 'users'],
          ['wallet', 'wallet'],
          ['settings', 'cog'],
          ['profile', 'user'],
        ] as const satisfies ReadonlyArray<readonly [string, HeroIconName]>
      ).map(([name, icon]) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            tabBarIcon: ({ color, focused }) => (
              <HeroIcon name={icon} size={26} color={color} focused={focused} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
