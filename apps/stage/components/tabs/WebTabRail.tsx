
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
import { IconBubble3 } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconBubble3';
import { IconGroup1 } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconGroup1';
import { IconWallet4 } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconWallet4';

const WEB_TAB_BAR_HEIGHT = 60;

export const TAB_ICONS: readonly (readonly [TabName, CentralIcon])[] = [
  ['index', IconBubble3],
  ['contacts', IconGroup1],
  ['wallet', IconWallet4],
];

const TAB_LABELS: Record<TabName, string> = { index: 'Chats', contacts: 'Contacts', wallet: 'Wallet' };

function TabIcon({ name, icon, active, unreadBadge }: {
  name: TabName; icon: CentralIcon; active: boolean; unreadBadge: string | undefined;
}): React.ReactElement {
  const pal = usePalette();
  return (
    <HoverTint>
      {(hovered) => (
    <Box>
      <Glyph icon={icon} size={24} color={active || hovered ? pal.link : pal.text}/>
      {name === 'index' && unreadBadge !== undefined ? (
        <Box
          minWidth={18} height={18} padding={{ x: 4 }} radius="full" background={pal.link}
          align="center" justify="center"
          style={{ position: 'absolute', top: -6, right: -14 }}
>
          <Text size="3xs" weight="semibold" color={pal.bg}>{unreadBadge}</Text>
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
  const activeIndex = pathname.startsWith('/settings') ? -1 : indexOfPathname(pathname);
  return (
    <>
      {TAB_ICONS.map(([name, icon], i) => {
        const icn = <TabIcon name={name} icon={icon} active={i === activeIndex} unreadBadge={unreadBadge}/>;
        const go = (): void => { router.navigate(TAB_HREF[name]); };
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
