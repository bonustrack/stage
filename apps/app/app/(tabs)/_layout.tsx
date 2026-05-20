/** Bottom tab bar — Home / Messenger / Search / Lines / Settings. */

import { useEffect, useMemo, useState } from 'react';
import { Tabs } from 'expo-router';
import { useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HeroIcon, type HeroIconName } from '../../components/HeroIcon';
import { loadConfig, isConfigured, type Config } from '../../lib/config';
import { useMessengerUnread } from '../../lib/messenger-unread';
import { useTail } from '../../lib/sse';

const MESSENGER_LINE = 'metro://messenger/owner';

export default function TabsLayout(): React.ReactElement {
  const dark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const bg = dark ? '#000000' : '#ffffff';
  const border = dark ? '#1f2630' : '#e5e9f0';
  const active = '#ffffff';
  const inactive = dark ? '#8a94a6' : '#5a6477';

  /** Tiny shared tail subscription scoped to the messenger line — purely to drive the unread badge. */
  const [cfg, setCfg] = useState<Config | null>(null);
  useEffect(() => { void loadConfig().then(setCfg); }, []);
  const tailOpts = useMemo(() => ({
    daemonUrl: cfg?.daemonUrl ?? '', token: cfg?.token ?? '',
    chat: MESSENGER_LINE, includeWebhooks: false,
  }), [cfg]);
  const { events } = useTail(tailOpts, !!cfg && isConfigured(cfg));
  const unread = useMessengerUnread(events);

  /** Hoisted so per-screen overrides can merge instead of replace. */
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
        headerStyle: { backgroundColor: bg },
        headerTintColor: dark ? '#e8ecf2' : '#1a1f29',
        headerTitleStyle: { fontFamily: 'Calibre-Semibold' },
        sceneStyle: { backgroundColor: bg },
        tabBarStyle,
        tabBarActiveTintColor: active,
        tabBarInactiveTintColor: inactive,
        tabBarShowLabel: false,
      }}
    >
      {(
        [
          ['index', 'Home', 'home', 0],
          ['messenger', 'Messenger', 'send', unread],
          ['search', 'Search', 'search', 0],
          ['lines', 'Lines', 'list', 0],
          ['settings', 'Settings', 'cog', 0],
        ] as const satisfies ReadonlyArray<readonly [string, string, HeroIconName, number]>
      ).map(([name, title, icon, badge]) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title,
            /** Messenger has its own chat UI — the title bar wastes space and looks out of place. */
            headerShown: name !== 'messenger',
            /** Hide the tab bar on messenger so the composer sits directly above the keyboard. */
            tabBarStyle: name === 'messenger' ? { ...tabBarStyle, display: 'none' } : tabBarStyle,
            tabBarIcon: ({ color, focused }) => (
              <HeroIcon name={icon} size={26} color={color} focused={focused} />
            ),
            tabBarBadge: badge > 0 ? badge : undefined,
            tabBarBadgeStyle: { backgroundColor: '#ffffff', color: '#000000', fontSize: 10, fontWeight: '700' },
          }}
        />
      ))}
    </Tabs>
  );
}
