import { FONT_SIZE } from '@stage-labs/kit/tokens';

import { Box, Col } from '../../components/layout';
import { usePathname, useRouter } from 'expo-router';
import { Platform } from 'react-native';
import { Tabs } from '../../lib/navigation';
import { useSafeAreaInsets } from '../../lib/safeArea';
import { Glyph } from '@stage-labs/kit/react-native/glyph';
import { Text } from '@stage-labs/kit/react-native/text';
import { usePalette } from '../../lib/theme';
import { TabsPager } from '../../components/SwipeTabs';
import { Topnav } from '../../components/Topnav';
import { useTopnavSlot } from '../../components/tabs/topnavSlots';
import {
  TAB_BADGE_POSITION, TAB_BADGE_SIZE, TAB_ICON_FRAME, TAB_ICONS, WebTabBar, WebTabRail, chatsTabOpensNewChat,
} from '../../components/tabs/WebTabRail';
import { useWebTabRail } from '../../lib/webLayout';
import { useVisibleUnreadCount } from '../../components/home/unreadCount';
import { unreadBadgeLabel } from '../../lib/format';
import { AccountAvatar } from '../../components/AccountAvatarButton';
import { SETTINGS_ROUTE } from '../../lib/routes';
import { Landing } from '../../components/landing/Landing';
import { useAccountGate } from '../../lib/accountGate';
import { useOpenNewChat } from '../../components/home/newChatFocus';

const WIDE_TAB_TITLES: Record<string, string> = { '/wallet': 'Wallet', '/contacts': 'Contacts' };

function HoistedTopnav({ rail, pathname }: { rail: boolean; pathname: string }): React.ReactElement {
  const slot = useTopnavSlot();
  if (slot?.override) return <>{slot.override}</>;
  const title = rail ? WIDE_TAB_TITLES[pathname] : undefined;
  const left = title === undefined ? undefined : <Text value={title} size="xl" weight="semibold" />;
  return <Topnav left={left} right={slot?.right} />;
}

function PagerOverlay({ insetTop, tabBarHeight, topnavHidden, rail, pathname }: {
  insetTop: number; tabBarHeight: number; topnavHidden: boolean; rail: boolean; pathname: string;
}): React.ReactElement | null {
  if (Platform.OS === 'web') {
    if (pathname.startsWith('/settings')) return null;
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

function useChatsTabListeners(pathname: string, wide: boolean): { tabPress: (e: { preventDefault: () => void }) => void } {
  const openNewChat = useOpenNewChat();
  return {
    tabPress: (e) => {
      if (!chatsTabOpensNewChat(pathname, wide)) return;
      e.preventDefault();
      openNewChat();
    },
  };
}

function nativeTabBarStyle(pal: ReturnType<typeof usePalette>, bottomInset: number) {
  return {
    backgroundColor: pal.toolbarBg,
    borderTopWidth: 1,
    borderTopColor: pal.border,
    elevation: 0,
    shadowOpacity: 0,
    height: 60 + bottomInset,
    paddingTop: 9,
    paddingBottom: bottomInset,
  };
}

export default function TabsLayout(): React.ReactElement {
  const pathname = usePathname();
  const router = useRouter();
  const unreadBadge = unreadBadgeLabel(useVisibleUnreadCount());
  const insets = useSafeAreaInsets();
  const pal = usePalette();
  const active = pal.link;
  const inactive = pal.text;
  const web = Platform.OS === 'web';
  const rail = useWebTabRail();
  const gate = useAccountGate();
  const chatsTabListeners = useChatsTabListeners(pathname, rail);

  const tabBarStyle = nativeTabBarStyle(pal, insets.bottom);
  const tabBarHeight = web && rail ? 0 : 60 + insets.bottom;

  if (gate.ready && !gate.hasAccount) return <Landing />;

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
          tabBarIconStyle: TAB_ICON_FRAME,
        }}
>
        {TAB_ICONS.map(([name, icon]) => (
          <Tabs.Screen
            key={name}
            name={name}
            listeners={name === 'index' ? chatsTabListeners : undefined}
            options={{
              tabBarIcon: ({ focused }) => (
                <Glyph icon={icon} size={24} color={focused ? active : inactive}/>
              ),
              ...(name === 'index'
                ? {
                    tabBarBadge: unreadBadge,
                    tabBarBadgeStyle: {
                      ...TAB_BADGE_POSITION,
                      backgroundColor: pal.link,
                      color: pal.bg,
                      fontSize: FONT_SIZE['3xs'],
                      fontFamily: 'Calibre-Semibold',
                      minWidth: TAB_BADGE_SIZE,
                      height: TAB_BADGE_SIZE,
                      lineHeight: TAB_BADGE_SIZE,
                    },
                  }
                : {}),
            }}
/>
        ))}
        <Tabs.Screen
          name="account"
          options={{
            tabBarIcon: () => <Box margin={{ top: -1 }}><AccountAvatar size={26}/></Box>,
            tabBarAccessibilityLabel: 'Account',
          }}
          listeners={{ tabPress: (e) => { e.preventDefault(); router.navigate(SETTINGS_ROUTE); } }}
/>
        <Tabs.Screen name="settings" options={{ href: null }}/>
      </Tabs>
      <PagerOverlay
        insetTop={insets.top}
        tabBarHeight={tabBarHeight}
        topnavHidden={rail && pathname === '/'}
        rail={rail}
        pathname={pathname}
      />
      {web ? (rail
        ? <WebTabRail pathname={pathname} unreadBadge={unreadBadge}/>
        : <WebTabBar pathname={pathname} unreadBadge={unreadBadge}/>
      ) : null}
    </Col>
  );
}
