
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Text } from '@stage-labs/kit/react-native/text';
import { Icon, type HeroIconName } from '@stage-labs/kit/react-native/icon';
import { useRouter } from 'expo-router';
import { Box, Col, Row, pinnedEdges } from '../layout';
import { usePalette } from '../../lib/theme';
import { TAB_HREF, indexOfPathname, type TabName } from '../SwipeTabs.config';
import { useTopChromeInset, WEB_TAB_RAIL_WIDTH } from '../../lib/webLayout';
import { AccountAvatarButton } from '../AccountAvatarButton';
import { RailTooltip } from './RailTooltip';

export const TAB_ICONS: readonly (readonly [TabName, HeroIconName])[] = [
  ['index', 'chatBubble'],
  ['contacts', 'users'],
  ['wallet', 'wallet'],
];

const TAB_LABELS: Record<TabName, string> = { index: 'Chats', contacts: 'Contacts', wallet: 'Wallet' };

function TabIcon({ name, icon, active, unreadBadge }: {
  name: TabName; icon: HeroIconName; active: boolean; unreadBadge: string | undefined;
}): React.ReactElement {
  const pal = usePalette();
  return (
    <Box>
      <Icon name={icon} size={24} color={active ? pal.link : pal.text} focused={active}/>
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
          <RailTooltip key={name} label={TAB_LABELS[name]} onPress={go}
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
  return (
    <Row
      height={60}
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
        <AccountAvatarButton size={32} opens="beside"/>
      </Box>
    </Col>
  );
}
