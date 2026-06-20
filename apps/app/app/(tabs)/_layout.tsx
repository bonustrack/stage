
import { Box, Col } from '../../components/layout';
import { fontSize } from '@stage-labs/kit/tokens';
import { Tabs, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type HeroIconName } from '@stage-labs/kit/icon';
import { usePalette } from '../../lib/theme';
import { TabsPager } from '../../components/SwipeTabs';
import { HoistedTopnav } from '../../components/tabs/HoistedTopnav';
import { useTotalUnread } from '../../lib/useTotalUnread';

function PagerOverlay({ insetTop, tabBarHeight }: { insetTop: number; tabBarHeight: number }): React.ReactElement {
  return (
    <Col
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        top: insetTop,
        left: 0,
        right: 0,
        bottom: tabBarHeight,
      }}
>
      {}
      <HoistedTopnav/>
      {}
      <Box flex={1}>
        <TabsPager/>
      </Box>
    </Col>
  );
}

export default function TabsLayout(): React.ReactElement {
  const pathname = usePathname();
  const unread = useTotalUnread();
  const unreadBadge = unread > 0 ? (unread > 99 ? '99+' : String(unread)) : undefined;
  const pagerVisible = !pathname.startsWith('/settings');
  const insets = useSafeAreaInsets();
  const pal = usePalette();
  const active = pal.link;
  const inactive = pal.text;

  const tabBarStyle = {
    backgroundColor: pal.toolbarBg,
    borderTopWidth: 1,
    borderTopColor: pal.border,
    elevation: 0,
    shadowOpacity: 0,
    height: 60 + insets.bottom,
    paddingTop: 6,
    paddingBottom: insets.bottom,
  };

  const tabBarHeight = 60 + insets.bottom;

  return (
    <Col surface="surface" flex={1}>
      {}
      <Box height={insets.top} surface="toolbar"
        pointerEvents="none"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1 }}
/>
      {}
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
        {}
        <Tabs.Screen name="settings" options={{ href: null }}/>
      </Tabs>
      {}
      {pagerVisible ? <PagerOverlay insetTop={insets.top} tabBarHeight={tabBarHeight}/> : null}
    </Col>
  );
}
