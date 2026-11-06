import { FONT_SIZE } from '@stage-labs/kit/tokens';
import { usePathname, useRouter } from 'expo-router';
import { Platform } from 'react-native';
import { Tabs } from '../../lib/navigation';
import { useSafeAreaInsets } from '../../components/layout/safeArea';
import { TAB_BAR_HEIGHT } from '../../components/layout/webChrome.core';
import { Glyph } from '@stage-labs/kit/react-native/glyph';
import { Text } from '@stage-labs/kit/react-native/text';
import { usePalette } from '../../lib/theme';
import { TabsPager } from '../../components/tabs/SwipeTabs';
import { Topnav } from '../../components/Topnav';
import { HomeTopnav } from '../../components/home/HomeTopnav';
import {
  TAB_BADGE_POSITION,
  TAB_BADGE_SIZE,
  TAB_ICON_FRAME,
  WebTabBar,
  WebTabRail,
  chatsTabOpensNewChat,
} from '../../components/tabs/WebTabRail';
import { useBoardHome, useRememberHomeView } from '../../components/tabs/boardHome';
import { homeViewAt } from '../../components/tabs/splitRoutes';
import { HIDDEN_TAB_ROUTES, PAGES, TAB_BAR_PAGES, tabPageAt } from '../../components/tabs/pages';
import { routeRendersPage } from '../../components/tabs/pageRenderer';
import { appIcon } from '../../components/widgets';
import { useWebTabRail } from '../../components/layout/webLayout';
import { useVisibleUnreadCount } from '../../components/home/unreadCount';
import { unreadBadgeLabel } from '../../lib/format';
import { AccountAvatar } from '../../components/AccountAvatarButton';
import { Landing } from '../../components/landing/Landing';
import { useAccountGate } from '../../lib/accountGate';
import { useOpenNewChat } from '../../components/home/newChatFocus';
import { Column } from '../../components/layout';

function HoistedTopnav({ rail, pathname }: { rail: boolean; pathname: string }): React.ReactElement {
  const boardHome = useBoardHome();
  const home = rail ? null : Platform.OS === 'web' ? homeViewAt(pathname) : boardHome ? 'board' : 'chats';
  if (home !== null) return <HomeTopnav view={home} pane={false} />;
  const title = rail ? tabPageAt(pathname)?.label : undefined;
  const left = title === undefined ? undefined : <Text text={title} size="xl" fontWeight="semibold" />;
  return <Topnav left={left} />;
}

function PagerOverlay({
  insetTop,
  tabBarHeight,
  topnavHidden,
  rail,
  pathname,
}: {
  insetTop: number;
  tabBarHeight: number;
  topnavHidden: boolean;
  rail: boolean;
  pathname: string;
}): React.ReactElement | null {
  if (routeRendersPage(pathname)) return null;
  if (Platform.OS === 'web') {
    return (
      <Column weight={1} padding={{ top: insetTop, bottom: tabBarHeight }}>
        {topnavHidden ? null : <HoistedTopnav rail={rail} pathname={pathname} />}
        <TabsPager />
      </Column>
    );
  }
  return (
    <Column pointerEvents="box-none" style={{ position: 'absolute', top: insetTop, bottom: tabBarHeight, left: 0, right: 0 }}>
      <HoistedTopnav rail={rail} pathname={pathname} />
      <Column weight={1}>
        <TabsPager />
      </Column>
    </Column>
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
    height: TAB_BAR_HEIGHT + bottomInset,
    paddingTop: 9,
    paddingBottom: bottomInset,
  };
}

function chatsTabBadge(pal: ReturnType<typeof usePalette>, unreadBadge: string | undefined) {
  return {
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
  useRememberHomeView();

  const tabBarStyle = nativeTabBarStyle(pal, insets.bottom);
  const tabBarHeight = web && rail ? 0 : TAB_BAR_HEIGHT + insets.bottom;

  if (gate.ready && !gate.hasAccount) return <Landing />;

  return (
    <Column surface="surface" weight={1}>
      {web ? null : (
        <Column
          height={insets.top}
          surface="toolbar"
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
        {TAB_BAR_PAGES.map((page) => (
          <Tabs.Screen
            key={page.tabRoute}
            name={page.tabRoute}
            listeners={page.id === 'chats' ? chatsTabListeners : undefined}
            options={{
              tabBarAccessibilityLabel: page.label,
              tabBarIcon: ({ focused }) => (
                <Glyph
                  icon={appIcon(page.icon)}
                  size={24}
                  color={focused || (page.id === 'chats' && pathname === PAGES.board.href) ? active : inactive}
                />
              ),
              ...(page.id === 'chats' ? chatsTabBadge(pal, unreadBadge) : {}),
            }}
          />
        ))}
        <Tabs.Screen
          name="account"
          options={{
            tabBarIcon: () => (
              <Column margin={{ top: -1 }}>
                <AccountAvatar size={26} />
              </Column>
            ),
            tabBarAccessibilityLabel: 'Account',
          }}
          listeners={{
            tabPress: (e) => {
              e.preventDefault();
              router.navigate(PAGES.settings.href);
            },
          }}
        />
        {HIDDEN_TAB_ROUTES.map((name) => (
          <Tabs.Screen key={name} name={name} options={{ href: null }} />
        ))}
      </Tabs>
      <PagerOverlay
        insetTop={insets.top}
        tabBarHeight={tabBarHeight}
        topnavHidden={rail && homeViewAt(pathname) !== null}
        rail={rail}
        pathname={pathname}
      />
      {web ? (
        rail ? (
          <WebTabRail pathname={pathname} unreadBadge={unreadBadge} />
        ) : (
          <WebTabBar pathname={pathname} unreadBadge={unreadBadge} />
        )
      ) : null}
    </Column>
  );
}
