import { usePathname, useRouter } from 'expo-router';
import { Text } from '@stage-labs/kit/react-native/text';
import { Tabs } from '../../lib/navigation';
import { usePalette } from '../../lib/theme';
import { useAccountGate } from '../../lib/accountGate';
import { useSafeAreaInsets } from '../layout/safeArea';
import { TAB_BAR_HEIGHT } from '../layout/webChrome.core';
import { HomeTopnav } from '../home/HomeTopnav';
import { Topnav } from '../Topnav';
import { AccountAvatar } from '../AccountAvatarButton';
import { Landing } from '../landing/Landing';
import { useOpenNewChat } from '../newChat/newChatFocus';
import { appIcon } from '../widgets';
import { TabsPager } from './TabsPager';
import { TAB_ICON_FRAME, TabIcon, useChatsTabBadge } from './TabIcon';
import { useBoardHome, useRememberHomeView } from './boardHome';
import { isTabRoute } from './splitRoutes';
import { HIDDEN_TAB_ROUTES, PAGES, TAB_BAR_PAGES, activeTabOf } from './pages';
import { chatsTabOpensNewChat, homeTabPresentation } from './WebTabRail.model';
import { routeRendersPage } from './pageRenderer';
import { Column } from '../layout';

function HoistedTopnav(): React.ReactElement {
  const board = useBoardHome();
  if (usePathname() === PAGES.contacts.href) return <Topnav left={<Text text={PAGES.contacts.label} size="xl" fontWeight="semibold" />} />;
  return <HomeTopnav view={board ? 'board' : 'chats'} pane={false} />;
}

function PagerOverlay({
  insetTop,
  tabBarHeight,
  pathname,
}: {
  insetTop: number;
  tabBarHeight: number;
  pathname: string;
}): React.ReactElement | null {
  if (routeRendersPage(pathname)) return null;
  return (
    <Column pointerEvents="box-none" style={{ position: 'absolute', top: insetTop, bottom: tabBarHeight, left: 0, right: 0 }}>
      <HoistedTopnav />
      <Column weight={1}>
        <TabsPager />
      </Column>
    </Column>
  );
}

function useHomeTabListeners(pathname: string, board: boolean): { tabPress: (e: { preventDefault: () => void }) => void } {
  const router = useRouter();
  const openNewChat = useOpenNewChat();
  return {
    tabPress: (e) => {
      if (chatsTabOpensNewChat(pathname, false, board)) {
        e.preventDefault();
        openNewChat();
      } else if (board) {
        e.preventDefault();
        router.navigate(PAGES.board.href);
      }
    },
  };
}

function tabBarStyle(pal: ReturnType<typeof usePalette>, bottomInset: number) {
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

export function TabsShell(): React.ReactElement {
  const pathname = usePathname();
  const router = useRouter();
  const unreadBadge = useChatsTabBadge();
  const insets = useSafeAreaInsets();
  const pal = usePalette();
  const gate = useAccountGate();
  const board = useBoardHome();
  const home = homeTabPresentation(board);
  const homeTabListeners = useHomeTabListeners(pathname, board);
  const activeTab = activeTabOf(pathname);
  const onTab = isTabRoute(pathname);
  useRememberHomeView();

  if (gate.ready && !gate.hasAccount) return <Landing />;

  return (
    <Column surface="surface" weight={1}>
      <Column
        height={insets.top}
        surface="toolbar"
        pointerEvents="none"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1 }}
      />
      <Tabs
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: 'transparent' },
          tabBarStyle: tabBarStyle(pal, insets.bottom),
          tabBarActiveTintColor: pal.link,
          tabBarInactiveTintColor: pal.text,
          tabBarShowLabel: false,
          tabBarIconStyle: TAB_ICON_FRAME,
        }}
      >
        {TAB_BAR_PAGES.map((page) => (
          <Tabs.Screen
            key={page.tabRoute}
            name={page.tabRoute}
            listeners={page.id === 'chats' ? homeTabListeners : undefined}
            options={{
              tabBarAccessibilityLabel: page.id === 'chats' ? home.label : page.label,
              tabBarIcon: ({ focused }) => (
                <TabIcon
                  icon={appIcon(page.id === 'chats' ? home.icon : page.icon)}
                  active={onTab ? activeTab === page.id : focused}
                  badge={page.id === 'chats' ? unreadBadge : undefined}
                />
              ),
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
      <PagerOverlay insetTop={insets.top} tabBarHeight={TAB_BAR_HEIGHT + insets.bottom} pathname={pathname} />
    </Column>
  );
}
