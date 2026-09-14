
import { useState } from 'react';
import { Box, Col } from '../../components/layout';
import { fontSize } from '@stage-labs/kit/tokens';
import { usePathname } from 'expo-router';
import { Platform } from 'react-native';
import { Tabs } from '../../lib/navigation/tabs';
import { useSafeAreaInsets } from '../../lib/safeArea';
import { Icon } from '@stage-labs/kit/react-native/icon';
import { Text } from '@stage-labs/kit/react-native/text';
import { usePalette } from '../../lib/theme';
import { TabsPager } from '../../components/SwipeTabs';
import { Topnav } from '../../components/Topnav';
import { useTopnavSlot } from '../../components/tabs/topnavSlots';
import { TAB_ICONS, WebTabBar, WebTabRail } from '../../components/tabs/WebTabRail';
import { useWebTabRail } from '../../components/tabs/useWebTabRail';
import { useTotalUnread } from '../../lib/useTotalUnread';
import { unreadBadgeLabel } from '../../lib/format';
import { AccountAvatar } from '../../components/AccountAvatarButton';
import { MenuSheet } from '../../components/MenuSheet';

const WIDE_TAB_TITLES: Record<string, string> = { '/wallet': 'Wallet', '/contacts': 'Contacts' };

function HoistedTopnav({ rail, pathname }: { rail: boolean; pathname: string }): React.ReactElement {
  const slot = useTopnavSlot();
  if (slot?.override) return <>{slot.override}</>;
  const title = rail ? WIDE_TAB_TITLES[pathname] : undefined;
  const left = title === undefined ? undefined : <Text value={title} size="4xl" weight="semibold" />;
  return <Topnav left={left} right={slot?.right} />;
}

function PagerOverlay({ insetTop, tabBarHeight, topnavHidden, rail, pathname }: {
  insetTop: number; tabBarHeight: number; topnavHidden: boolean; rail: boolean; pathname: string;
}): React.ReactElement {
  if (Platform.OS === 'web') {
    return (
      <Col flex={1} padding={{ top: insetTop, bottom: tabBarHeight }}>
        {topnavHidden ? null : <HoistedTopnav rail={rail} pathname={pathname}/>}
        <TabsPager/>
      </Col>
    );
  }
  return (
    <Col
      pointerEvents="box-none"
      style={{ position: 'absolute', top: insetTop, bottom: tabBarHeight, left: 0, right: 0 }}
>
      <HoistedTopnav rail={rail} pathname={pathname}/>
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
  const [accountMenu, setAccountMenu] = useState(false);

  const tabBarStyle = {
    backgroundColor: pal.toolbarBg,
    borderTopWidth: 1,
    borderTopColor: pal.border,
    elevation: 0,
    shadowOpacity: 0,
    height: 60 + insets.bottom,
    paddingTop: 9,
    paddingBottom: insets.bottom,
    ...(web ? { display: 'none' as const } : {}),
  };

  const tabBarHeight = web && rail ? 0 : 60 + insets.bottom;

  return (
    <Col surface="surface" flex={1}>
      {web ? null : (
        <Box height={insets.top} surface="toolbar"
          pointerEvents="none"
          style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1 }}
/>
      )}
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
                <Icon name={icon} size={24} color={color} focused={focused}/>
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
        <Tabs.Screen
          name="account"
          options={{ tabBarIcon: () => <AccountAvatar size={26}/>, tabBarAccessibilityLabel: 'Account' }}
          listeners={{ tabPress: (e) => { e.preventDefault(); setAccountMenu(true); } }}
/>
        <Tabs.Screen name="settings" options={{ href: null }}/>
      </Tabs>
      {pagerVisible ? (
        <PagerOverlay
          insetTop={insets.top}
          tabBarHeight={tabBarHeight}
          topnavHidden={rail && pathname === '/'}
          rail={rail}
          pathname={pathname}
        />
      ) : null}
      {web ? (rail
        ? <WebTabRail pathname={pathname} unreadBadge={unreadBadge}/>
        : <WebTabBar pathname={pathname} unreadBadge={unreadBadge}/>
      ) : <MenuSheet visible={accountMenu} anchor={null} onClose={() => { setAccountMenu(false); }}/>}
    </Col>
  );
}
