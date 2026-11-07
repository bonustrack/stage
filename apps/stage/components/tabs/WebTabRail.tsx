import { Pressable } from '@stage-labs/kit/react-native/pressable';
import type { CentralIcon } from '@stage-labs/kit/react-native/glyph';
import { useRouter, type Href } from 'expo-router';
import { usePalette } from '../../lib/theme';
import { useTopChromeInset, WEB_TAB_RAIL_WIDTH } from '../layout/webLayout';
import { AccountAvatarButton } from '../AccountAvatarButton';
import { RailTooltip } from './RailTooltip';
import { HoverTint } from '../hover';
import { appIcon } from '../widgets';
import { useReportBottomChrome } from '../layout/bottomChrome';
import { TabIcon, useChatsTabBadge } from './TabIcon';
import { TAB_BAR_HEIGHT } from '../layout/webChrome.core';
import { requestNewChatFocus, useOpenNewChat } from '../newChat/newChatFocus';
import { useBoardHome } from './boardHome';
import { railMenuPages, isMenuPageOpen, isMenuPageRoute } from './menuPages';
import { isTabRoute } from './splitRoutes';
import { TAB_BAR_PAGES, activeTabOf, chatsTabOpensNewChat } from './pages';
import { useDeveloperMode } from '../../lib/developerMode';
import { Column, Row, pinnedEdges } from '../layout';

const RAIL_BUTTON = { height: 48, alignItems: 'center', justifyContent: 'center' } as const;

function HoverTabIcon({ icon, active, badge }: { icon: CentralIcon; active: boolean; badge?: string }): React.ReactElement {
  return <HoverTint>{(hovered) => <TabIcon icon={icon} active={active || hovered} badge={badge} />}</HoverTint>;
}

function useRailNavigate(pathname: string): (href: Href) => void {
  const router = useRouter();
  const fromMenuPage = isMenuPageRoute(pathname) && !isTabRoute(pathname);
  return (href) => {
    if (fromMenuPage) router.dismissTo(href);
    else router.navigate(href);
  };
}

function TabButtons({ pathname, vertical }: { pathname: string; vertical: boolean }): React.ReactElement {
  const navigate = useRailNavigate(pathname);
  const unreadBadge = useChatsTabBadge();
  const openNewChat = useOpenNewChat();
  const activeTab = activeTabOf(pathname, useBoardHome());
  return (
    <>
      {TAB_BAR_PAGES.map((page) => {
        const chats = page.id === 'chats';
        const active = page.id === activeTab;
        const icn = <HoverTabIcon icon={appIcon(page.icon)} active={active} badge={chats ? unreadBadge : undefined} />;
        const go = (): void => {
          if (chats && chatsTabOpensNewChat(pathname, vertical)) {
            openNewChat();
            return;
          }
          if (chats) requestNewChatFocus();
          navigate(page.href);
        };
        return vertical ? (
          <RailTooltip key={page.id} label={page.label} onPress={go} placement="beside" style={RAIL_BUTTON}>
            {icn}
          </RailTooltip>
        ) : (
          <Pressable
            key={page.id}
            accessibilityRole="button"
            accessibilityLabel={page.label}
            accessibilityState={{ selected: active }}
            onPress={go}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
          >
            {icn}
          </Pressable>
        );
      })}
    </>
  );
}

function MenuPageButtons({ pathname }: { pathname: string }): React.ReactElement {
  const navigate = useRailNavigate(pathname);
  const developerMode = useDeveloperMode();
  return (
    <>
      {railMenuPages(developerMode).map((page) => (
        <RailTooltip
          key={page.href}
          label={page.label}
          onPress={() => {
            navigate(page.href);
          }}
          placement="beside"
          style={RAIL_BUTTON}
        >
          <HoverTabIcon icon={appIcon(page.icon)} active={isMenuPageOpen(pathname, page.href)} />
        </RailTooltip>
      ))}
    </>
  );
}

export function WebTabBar({ pathname }: { pathname: string }): React.ReactElement {
  const pal = usePalette();
  useReportBottomChrome(TAB_BAR_HEIGHT);
  return (
    <Row
      height={TAB_BAR_HEIGHT}
      surface="toolbar"
      style={[pinnedEdges({ bottom: 0, left: 0, right: 0 }, 3), { borderTopWidth: 1, borderTopColor: pal.border }]}
    >
      <TabButtons pathname={pathname} vertical={false} />
      <Column weight={1} align="center" justify="center">
        <AccountAvatarButton size={26} />
      </Column>
    </Row>
  );
}

export function WebTabRail({ pathname }: { pathname: string }): React.ReactElement {
  const pal = usePalette();
  const inset = useTopChromeInset();
  return (
    <Column
      width={WEB_TAB_RAIL_WIDTH}
      padding={{ top: 12 }}
      gap={4}
      surface="toolbar"
      style={[pinnedEdges({ top: inset, bottom: 0, left: 0 }, 3), { borderRightWidth: inset > 0 ? 0 : 1, borderRightColor: pal.border }]}
    >
      <TabButtons pathname={pathname} vertical />
      <MenuPageButtons pathname={pathname} />
      <Column weight={1} />
      <Column align="center" padding={{ bottom: 16 }}>
        <AccountAvatarButton size={32} />
      </Column>
    </Column>
  );
}
