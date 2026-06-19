/** Bottom tab bar — Messenger (channel list) + Settings.
 *  Mirrors the minimal icon-only layout from acdee49^ — solid bg matching the
 *  active theme, no labels, status-bar inset baked into `sceneStyle.paddingTop`
 *  so individual screens don't have to reach for `useSafeAreaInsets` themselves. */

import { Box, Col } from '../../components/layout';
import { fontSize } from '@metro-labs/kit/tokens';
import { Tabs, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type HeroIconName } from '@metro-labs/kit/icon';
import { usePalette } from '../../lib/theme';
import { TabsPager } from '../../components/SwipeTabs';
import { HoistedTopnav } from '../../components/tabs/HoistedTopnav';
import { useTotalUnread } from '../../lib/useTotalUnread';

/** Bottom tab navigator hosting the Messenger, Contacts and Wallet pager scenes. */
export default function TabsLayout(): React.ReactElement {
  const pathname = usePathname();
  /** Total unread across all non-archived convs - drives the badge on the
   *  Messenger (index) tab. Live: updates as messages arrive / are read. */
  const unread = useTotalUnread();
  const unreadBadge = unread > 0 ? (unread > 99 ? '99+' : String(unread)) : undefined;
  /** The pager mounts the three swipe-tab bodies (Channels/Contacts/Wallet).
   *  Settings is the only non-pager tab route → hide the pager overlay there so
   *  the real SettingsScreen rendered by the route shows through. */
  const pagerVisible = !pathname.startsWith('/settings');
  const insets = useSafeAreaInsets();
  const pal = usePalette();
  const active = pal.link; // #ffffff / #000000
  // inactive nav icon = muted; no `muted` token yet → map to `text`. TODO: muted token.
  const inactive = pal.text;

  const tabBarStyle = {
    backgroundColor: pal.toolbarBg,
    /** Hairline top border on the footer nav (palette border token). Kill
     *  Android's default elevation shadow so only the border line shows. */
    borderTopWidth: 1,
    borderTopColor: pal.border,
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
    <Col surface="surface" flex={1}>
      {/* Status-bar inset filler: paint the top safe-area (behind the Android
          system icons) with toolbarBg so the tab topnavs - which start below
          insets.top - extend seamlessly to the very top edge. Sits under the
          pager overlay; toolbarBg matches the topnav fill below it. */}
      <Box height={insets.top} surface="toolbar"
        pointerEvents="none"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1 }}
/>
      {/* `Tabs` stays mounted as the ROUTING + tab-bar source of truth: deep
          links to /wallet etc. resolve, the URL is correct, and the active
          highlight is router-driven. The route scenes themselves render
          nothing (placeholders) — the real content is the single `TabsPager`
          overlaid below, which mounts all five bodies side-by-side and follows
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
            ['contacts', 'users'],
            ['wallet', 'wallet'],
          ] as const satisfies readonly (readonly [string, HeroIconName])[]
        ).map(([name, icon]) => (
          <Tabs.Screen
            key={name}
            name={name}
            options={{
              tabBarIcon: ({ color, focused }) => (
                <Icon name={icon} size={26} color={color} focused={focused}/>
              ),
              // Messenger tab (index) shows the total unread-count badge.
              ...(name === 'index'
                ? {
                    tabBarBadge: unreadBadge,
                    tabBarBadgeStyle: {
                      backgroundColor: pal.link,
                      color: pal.bg,
                      fontSize: fontSize('3xs'),
                      fontFamily: 'Calibre-Semibold',
                      minWidth: 18,
                      height: 18,
                      lineHeight: 18,
                    },
                  }
                : {}),
            }}
/>
        ))}
        {/* Settings is reachable only from the Menu sheet now - keep the route
            (so the menu can navigate to /settings) but hide it from the bar. */}
        <Tabs.Screen name="settings" options={{ href: null }}/>
      </Tabs>
      {/* Pager overlay — covers the scene area (status-bar inset at top, stops
          above the tab bar at the bottom) so the tab bar keeps its taps. */}
      {pagerVisible ? (
        <Col
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            top: insets.top,
            left: 0,
            right: 0,
            bottom: tabBarHeight,
          }}
>
          {/* ONE fixed Topnav, ABOVE the pager. A sibling of the pager strip, so
              a horizontal tab-swipe (which translates the strip) and a vertical
              scroll inside a tab both leave it pinned. It is UNIFORM: always the
              Home bar (identity + search/requests/overflow) on every tab. */}
          <HoistedTopnav/>
          {/* Pager below the bar as the flex:1 scroll region. It now mounts only
              the scrollable BODIES of each tab (no per-tab header). */}
          <Box flex={1}>
            <TabsPager/>
          </Box>
        </Col>
      ) : null}
    </Col>
  );
}
