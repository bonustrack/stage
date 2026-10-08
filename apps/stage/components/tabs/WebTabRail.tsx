import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Text } from '@stage-labs/kit/react-native/text';
import { Glyph, type CentralIcon } from '@stage-labs/kit/react-native/glyph';
import { useRouter } from 'expo-router';
import { Box, Col, Row, pinnedEdges } from '../layout';
import { usePalette } from '../../lib/theme';
import { TAB_HREF, indexOfPathname, type TabName } from '../SwipeTabs.config';
import { useTopChromeInset, WEB_TAB_RAIL_WIDTH } from '../../lib/webLayout';
import { AccountAvatarButton } from '../AccountAvatarButton';
import { RailTooltip } from './RailTooltip';
import { HoverTint } from '../hover';
import { useReportBottomChrome } from '../../lib/bottomChrome';
import { useHomeView } from '../../lib/homeView';
import { IconBubble3 } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconBubble3';
import { IconColumns3Wide } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconColumns3Wide';
import { IconGroup1 } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconGroup1';
import { IconWallet4 } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconWallet4';
import { requestNewChatFocus, useOpenNewChat } from '../home/newChatFocus';

export function chatsTabOpensNewChat(pathname: string, wide: boolean): boolean {
  return !wide && pathname === '/';
}

export const TAB_ICON_FRAME = { width: 31, height: 28 } as const;

export const TAB_BADGE_SIZE = 18;

export const TAB_BADGE_POSITION = { position: 'absolute', top: -3, right: -3 } as const;

const WEB_TAB_BAR_HEIGHT = 60;

type TabIcons = readonly (readonly [TabName, CentralIcon])[];

const TAB_ICONS: TabIcons = [
  ['index', IconBubble3],
  ['contacts', IconGroup1],
  ['wallet', IconWallet4],
];

const BOARD_TAB_ICONS: TabIcons = TAB_ICONS.map(([name, icon]): readonly [TabName, CentralIcon] => [name, name === 'index' ? IconColumns3Wide : icon]);

export function useTabIcons(): TabIcons {
  return useHomeView().view === 'board' ? BOARD_TAB_ICONS : TAB_ICONS;
}

const TAB_LABELS: Record<TabName, string> = { index: 'Chats', contacts: 'Contacts', wallet: 'Wallet', settings: 'Settings' };

function TabIcon({ name, icon, active, unreadBadge }: {
  name: TabName; icon: CentralIcon; active: boolean; unreadBadge: string | undefined;
}): React.ReactElement {
  const pal = usePalette();
  return (
    <HoverTint>
      {(hovered) => (
    <Box width={TAB_ICON_FRAME.width} height={TAB_ICON_FRAME.height} align="center" justify="center">
      <Glyph icon={icon} size={24} color={active || hovered ? pal.link : pal.text}/>
      {name === 'index' && unreadBadge !== undefined ? (
        <Box
          minWidth={TAB_BADGE_SIZE} height={TAB_BADGE_SIZE} padding={{ x: 4 }} radius="full" background={pal.link}
          align="center" justify="center"
          style={TAB_BADGE_POSITION}
>
          <Text weight="semibold" color={pal.bg} size="3xs">{unreadBadge}</Text>
        </Box>
      ) : null}
    </Box>
      )}
    </HoverTint>
  );
}

function TabButtons({ pathname, unreadBadge, vertical }: {
  pathname: string;
  unreadBadge: string | undefined;
  vertical: boolean;
}): React.ReactElement {
  const router = useRouter();
  const openNewChat = useOpenNewChat();
  const tabIcons = useTabIcons();
  const activeIndex = pathname.startsWith('/settings') ? -1 : indexOfPathname(pathname);
  return (
    <>
      {tabIcons.map(([name, icon], i) => {
        const icn = <TabIcon name={name} icon={icon} active={i === activeIndex} unreadBadge={unreadBadge}/>;
        const go = (): void => {
          if (name === 'index' && chatsTabOpensNewChat(pathname, vertical)) {
            openNewChat();
            return;
          }
          if (name === 'index') requestNewChatFocus();
          router.navigate(TAB_HREF[name]);
        };
        return vertical ? (
          <RailTooltip key={name} label={TAB_LABELS[name]} onPress={go} placement="beside"
            style={{ height: 48, alignItems: 'center', justifyContent: 'center' }}>
            {icn}
          </RailTooltip>
        ) : (
          <Pressable key={name} onPress={go} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            {icn}
          </Pressable>
        );
      })}
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
      <Box flex={1} align="center" justify="center">
        <AccountAvatarButton size={26}/>
      </Box>
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
    <Col
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
      <Box flex={1}/>
      <Box align="center" padding={{ bottom: 16 }}>
        <AccountAvatarButton size={32}/>
      </Box>
    </Col>
  );
}
