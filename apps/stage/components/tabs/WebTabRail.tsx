
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Text } from '@stage-labs/kit/react-native/text';
import { Icon, type HeroIconName } from '@stage-labs/kit/react-native/icon';
import { useRouter } from 'expo-router';
import { Box, Col, Row, pinnedEdges } from '../layout';
import { usePalette } from '../../lib/theme';
import { TAB_HREF, indexOfPathname, type TabName } from '../SwipeTabs.config';
import { useTopChromeInset, WEB_TAB_RAIL_WIDTH } from '../../lib/webLayout';
import { AccountAvatarButton } from '../AccountAvatarButton';

export const TAB_ICONS: readonly (readonly [TabName, HeroIconName])[] = [
  ['index', 'chatBubble'],
  ['contacts', 'users'],
  ['wallet', 'wallet'],
];

function TabButtons({ pathname, unreadBadge, vertical }: {
  pathname: string;
  unreadBadge: string | undefined;
  vertical: boolean;
}): React.ReactElement {
  const router = useRouter();
  const pal = usePalette();
  const activeIndex = pathname.startsWith('/settings') ? -1 : indexOfPathname(pathname);
  return (
    <>
      {TAB_ICONS.map(([name, icon], i) => (
        <Pressable
          key={name}
          onPress={() => { router.navigate(TAB_HREF[name]); }}
          style={vertical
            ? { height: 56, alignItems: 'center', justifyContent: 'center' }
            : { flex: 1, alignItems: 'center', justifyContent: 'center' }}
>
          <Box>
            <Icon
              name={icon}
              size={24}
              color={i === activeIndex ? pal.link : pal.text}
              focused={i === activeIndex}
/>
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
        </Pressable>
      ))}
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
