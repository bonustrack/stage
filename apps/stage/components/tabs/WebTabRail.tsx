import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Text } from '@stage-labs/kit/react-native/text';
import { Glyph, type CentralIcon } from '@stage-labs/kit/react-native/glyph';
import { useRouter, type Href } from 'expo-router';
import { usePalette } from '../../lib/theme';
import { TAB_HREF, TAB_ORDER, homeTabIndex, type TabName } from '../SwipeTabs.config';
import { useTopChromeInset, WEB_TAB_RAIL_WIDTH } from '../../lib/webLayout';
import { AccountAvatarButton } from '../AccountAvatarButton';
import { RailTooltip } from './RailTooltip';
import { HoverTint } from '../hover';
import { appIcon } from '../widgets';
import { useReportBottomChrome } from '../../lib/bottomChrome';
import { IconBubble3 } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconBubble3';
import { IconGroup1 } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconGroup1';
import { IconWallet4 } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconWallet4';
import { requestNewChatFocus, useOpenNewChat } from '../home/newChatFocus';
import { useBoardHome } from './boardHome';
import { menuPagesFor, isMenuPageOpen, isMenuPageRoute } from './menuPages';
import { isTabRoute } from './splitRoutes';
import { useDeveloperMode } from '../../lib/developerMode';
import { Column, Row, pinnedEdges } from '../layout';

export function chatsTabOpensNewChat(pathname: string, wide: boolean): boolean {
  return !wide && pathname === '/';
}

export const TAB_ICON_FRAME = { width: 31, height: 28 } as const;

export const TAB_BADGE_SIZE = 18;

export const TAB_BADGE_POSITION = { position: 'absolute', top: -3, right: -3 } as const;

const WEB_TAB_BAR_HEIGHT = 60;

export const TAB_ICONS: readonly (readonly [TabName | 'contacts', CentralIcon])[] = [
  ['index', IconBubble3],
  ['contacts', IconGroup1],
  ['wallet', IconWallet4],
];

const TAB_LABELS: Record<TabName | 'contacts', string> = { index: 'Chats', board: 'Board', contacts: 'Contacts', wallet: 'Wallet', settings: 'Settings' };

const RAIL_BUTTON = { height: 48, alignItems: 'center', justifyContent: 'center' } as const;

function activeTabIndex(pathname: string, boardHome: boolean): number {
  return pathname.startsWith('/settings') ? -1 : homeTabIndex(pathname, boardHome);
}

function TabIcon({ icon, active, badge }: {
  icon: CentralIcon; active: boolean; badge?: string;
}): React.ReactElement {
  const pal = usePalette();
  return (
    <HoverTint>
      {(hovered) => (
    <Column width={TAB_ICON_FRAME.width} height={TAB_ICON_FRAME.height} align="center" justify="center">
      <Glyph icon={icon} size={24} color={active || hovered ? pal.link : pal.text}/>
      {badge !== undefined ? (
        <Column
          minWidth={TAB_BADGE_SIZE} height={TAB_BADGE_SIZE} padding={{ x: 4 }} radius="full" background={pal.link}
          align="center" justify="center"
          style={TAB_BADGE_POSITION}
>
          <Text fontWeight="semibold" color={pal.bg} size="3xs">{badge}</Text>
        </Column>
      ) : null}
    </Column>
      )}
    </HoverTint>
  );
}

function useRailNavigate(pathname: string): (href: Href) => void {
  const router = useRouter();
  const fromMenuPage = isMenuPageRoute(pathname) && !isTabRoute(pathname);
  return (href) => {
    if (fromMenuPage) router.dismissTo(href);
    else router.navigate(href);
  };
}

function TabButtons({ pathname, unreadBadge, vertical }: {
  pathname: string;
  unreadBadge: string | undefined;
  vertical: boolean;
}): React.ReactElement {
  const navigate = useRailNavigate(pathname);
  const openNewChat = useOpenNewChat();
  const activeName = TAB_ORDER[activeTabIndex(pathname, useBoardHome())];
  return (
    <>
      {TAB_ICONS.map(([name, icon]) => {
        const active = name === 'contacts' ? isMenuPageOpen(pathname, '/contacts')
          : !isMenuPageRoute(pathname) && (name === activeName || (name === 'index' && activeName === 'board'));
        const icn = <TabIcon icon={icon} active={active} badge={name === 'index' ? unreadBadge : undefined}/>;
        const go = (): void => {
          if (name === 'index' && chatsTabOpensNewChat(pathname, vertical)) {
            openNewChat();
            return;
          }
          if (name === 'index') requestNewChatFocus();
          navigate(TAB_HREF[name]);
        };
        return vertical ? (
          <RailTooltip key={name} label={TAB_LABELS[name]} onPress={go} placement="beside" style={RAIL_BUTTON}>
            {icn}
          </RailTooltip>
        ) : (
          <Pressable key={name} accessibilityRole="button" accessibilityLabel={TAB_LABELS[name]}
            accessibilityState={{ selected: active }} onPress={go} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
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
      {menuPagesFor(true, developerMode).filter(page => page.href !== '/contacts').map((page) => (
        <RailTooltip key={page.href} label={page.label} onPress={() => { navigate(page.href); }} placement="beside" style={RAIL_BUTTON}>
          <TabIcon icon={appIcon(page.icon)} active={isMenuPageOpen(pathname, page.href)}/>
        </RailTooltip>
      ))}
    </>
  );
}

export function WebTabBar({ pathname, unreadBadge }: {
  pathname: string;
  unreadBadge: string | undefined;
}): React.ReactElement {
  const pal = usePalette();
  useReportBottomChrome(WEB_TAB_BAR_HEIGHT);
  return (
    <Row
      height={WEB_TAB_BAR_HEIGHT}
      surface="toolbar"
      style={[pinnedEdges({ bottom: 0, left: 0, right: 0 }, 3), { borderTopWidth: 1, borderTopColor: pal.border }]}
>
      <TabButtons pathname={pathname} unreadBadge={unreadBadge} vertical={false}/>
      <Column weight={1} align="center" justify="center">
        <AccountAvatarButton size={26}/>
      </Column>
    </Row>
  );
}

export function WebTabRail({ pathname, unreadBadge }: {
  pathname: string;
  unreadBadge: string | undefined;
}): React.ReactElement {
  const pal = usePalette();
  const inset = useTopChromeInset();
  return (
    <Column
      width={WEB_TAB_RAIL_WIDTH}
      padding={{ top: 12 }}
      gap={4}
      surface="toolbar"
      style={[
        pinnedEdges({ top: inset, bottom: 0, left: 0 }, 3),
        { borderRightWidth: inset > 0 ? 0 : 1, borderRightColor: pal.border },
      ]}
>
      <TabButtons pathname={pathname} unreadBadge={unreadBadge} vertical/>
      <MenuPageButtons pathname={pathname}/>
      <Column weight={1}/>
      <Column align="center" padding={{ bottom: 16 }}>
        <AccountAvatarButton size={32}/>
      </Column>
    </Column>
  );
}
