/** Bottom tab bar — Messenger (channel list) + Settings.
 *  Mirrors the minimal icon-only layout from acdee49^ — solid bg matching the
 *  active theme, no labels, status-bar inset baked into `sceneStyle.paddingTop`
 *  so individual screens don't have to reach for `useSafeAreaInsets` themselves. */

import { Box } from '../../components/layout';
import { Tabs, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSharedValue } from 'react-native-reanimated';
import { Icon, type HeroIconName } from '@metro-labs/kit/icon';
import { usePalette } from '../../lib/theme';
import { TabsPager } from '../../components/SwipeTabs';
import { LeftDrawer } from '../../components/LeftDrawer';

export default function TabsLayout(): React.ReactElement {
  /** 0 = drawer closed, 1 = fully open. Shared by the pager (which drives it on a
   *  Home rightward drag) and the LeftDrawer (which renders it + owns close). */
  const drawerProgress = useSharedValue(0);
  const pathname = usePathname();
  /** The pager only mounts the five tab bodies (Home/Search/Wallet/Notifications/Profile).
   *  Settings is a non-pager route now → hide the pager overlay there so the real
   *  SettingsScreen rendered by the route shows through. */
  const pagerVisible = !pathname.startsWith('/settings');
  const insets = useSafeAreaInsets();
  const pal = usePalette();
  const bg = pal.bg; // #0e0f10 / #ffffff
  const border = pal.border; // #282a2d / #e4e4e5
  const active = pal.link; // #ffffff / #000000
  // inactive nav icon = muted; no `muted` token yet → map to `text`. TODO: muted token.
  const inactive = pal.text;

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

  /** The bottom tab bar's full height (content + safe-area inset) — used to
   *  inset the pager overlay so its content stops exactly above the bar. */
  const tabBarHeight = 60 + insets.bottom;

  return (
    <Box style={{ flex: 1, backgroundColor: bg }}>
      {/* `Tabs` stays mounted as the ROUTING + tab-bar source of truth: deep
          links to /wallet etc. resolve, the URL is correct, and the active
          highlight is router-driven. The route scenes themselves render
          nothing (placeholders) — the real content is the single `TabsPager`
          overlaid below, which mounts all four bodies side-by-side and follows
          the finger on a horizontal swipe. */}
      <Tabs
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: 'transparent' },
          tabBarStyle,
          tabBarActiveTintColor: active,
          tabBarInactiveTintColor: inactive,
          tabBarShowLabel: false,
        }}
      >
        {(
          [
            ['index', 'chatBubble'],
            ['search', 'search'],
            ['wallet', 'wallet'],
            ['notifications', 'bell'],
            ['profile', 'user'],
          ] as const satisfies ReadonlyArray<readonly [string, HeroIconName]>
        ).map(([name, icon]) => (
          <Tabs.Screen
            key={name}
            name={name}
            options={{
              tabBarIcon: ({ color, focused }) => (
                <Icon name={icon} size={26} color={color} focused={focused} />
              ),
            }}
          />
        ))}
        {/* Settings is reachable only from the LeftDrawer now — keep the route
            (so the drawer can navigate to /settings) but hide it from the bar. */}
        <Tabs.Screen name="settings" options={{ href: null }} />
      </Tabs>
      {/* Pager overlay — covers the scene area (status-bar inset at top, stops
          above the tab bar at the bottom) so the tab bar keeps its taps. */}
      {pagerVisible ? (
        <Box
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            top: insets.top,
            left: 0,
            right: 0,
            bottom: tabBarHeight,
          }}
        >
          <TabsPager drawerProgress={drawerProgress} />
        </Box>
      ) : null}
      {/* Left drawer overlay — full screen, ABOVE the pager + tab bar (X-style:
          the panel + dim backdrop cover most of the screen). pointerEvents is
          'none' while closed so it never steals taps from the tabs underneath. */}
      <LeftDrawer progress={drawerProgress} />
    </Box>
  );
}
