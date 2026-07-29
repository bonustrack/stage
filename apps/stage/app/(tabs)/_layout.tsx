
import { Box, Col } from '../../components/layout';
import { fontSize } from '@stage-labs/kit/tokens';
import { Tabs, usePathname } from 'expo-router';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@stage-labs/kit/react-native/icon';
import { usePalette } from '../../lib/theme';
import { TabsPager } from '../../components/SwipeTabs';
import { Topnav } from '../../components/Topnav';
import { useTopnavSlot } from '../../components/tabs/topnavSlots';
import { TAB_ICONS, WebTabBar, WebTabRail } from '../../components/tabs/WebTabRail';
import { useWebTabRail } from '../../components/tabs/useWebTabRail';
import { useTotalUnread } from '../../lib/useTotalUnread';
import { unreadBadgeLabel } from '../../lib/format';

function HoistedTopnav(): React.ReactElement {
  const slot = useTopnavSlot();
  if (slot?.override) return <>{slot.override}</>;
  return <Topnav right={slot?.right} />;
}

function PagerOverlay({ insetTop, tabBarHeight, topnavHidden }: {
  insetTop: number; tabBarHeight: number; topnavHidden: boolean;
}): React.ReactElement {
  if (Platform.OS === 'web') {
    return (
      <Col
        pointerEvents="box-none"
        width="100vw"
        margin={{ left: '-50vw' }}
        style={{ position: 'absolute', top: 0, bottom: 0, left: '50%' }}
>
        {}
        <Box pointerEvents="box-none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
          <TabsPager/>
        </Box>
        {}
        {topnavHidden ? null : (
          <Box pointerEvents="box-none" style={{ position: 'absolute', top: insetTop, left: 0, right: 0, zIndex: 2 }}>
            <HoistedTopnav/>
          </Box>
        )}
      </Col>
    );
  }
  return (
    <Col
      pointerEvents="box-none"
      style={{ position: 'absolute', top: insetTop, bottom: tabBarHeight, left: 0, right: 0 }}
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
  const unreadBadge = unreadBadgeLabel(unread);
  const pagerVisible = !pathname.startsWith('/settings');
  const insets = useSafeAreaInsets();
  const pal = usePalette();
  const active = pal.link;
  const inactive = pal.text;
  const web = Platform.OS === 'web';
  const rail = useWebTabRail();

  const tabBarStyle = {
    backgroundColor: pal.toolbarBg,
    borderTopWidth: 1,
    borderTopColor: pal.border,
    elevation: 0,
    shadowOpacity: 0,
    height: 60 + insets.bottom,
    paddingTop: 6,
    paddingBottom: insets.bottom,
    ...(web ? { display: 'none' as const } : {}),
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
        {TAB_ICONS.map(([name, icon]) => (
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
      {pagerVisible ? (
        <PagerOverlay
          insetTop={insets.top}
          tabBarHeight={tabBarHeight}
          topnavHidden={rail && pathname === '/'}
        />
      ) : null}
      {}
      {web ? (rail
        ? <WebTabRail pathname={pathname} unreadBadge={unreadBadge}/>
        : <WebTabBar pathname={pathname} unreadBadge={unreadBadge}/>
      ) : null}
    </Col>
  );
}
