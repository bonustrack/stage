
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Text } from '@stage-labs/kit/react-native/text';
import { Icon, type HeroIconName } from '@stage-labs/kit/react-native/icon';
import { useRouter } from 'expo-router';
import { Box, Col, Row, WEB_CHROME_WIDTH } from '../layout';
import { usePalette } from '../../lib/theme';
import { TAB_HREF, indexOfPathname, type TabName } from '../SwipeTabs.config';
import { WEB_TAB_RAIL_WIDTH } from './useWebTabRail';

export const TAB_ICONS: readonly (readonly [TabName, HeroIconName])[] = [
  ['index', 'chatBubble'],
  ['contacts', 'users'],
  ['wallet', 'wallet'],
];

export function TabButtons({ pathname, unreadBadge, vertical }: {
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
              size={26}
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
      width={WEB_CHROME_WIDTH}
      height={60}
      margin={{ left: '-50vw' }}
      padding={{ top: 6 }}
      surface="toolbar"
      style={{
        position: 'absolute', bottom: 0, left: '50%',
        borderTopWidth: 1, borderTopColor: pal.border, zIndex: 3,
      }}
>
      <TabButtons pathname={pathname} unreadBadge={unreadBadge} vertical={false}/>
    </Row>
  );
}

export function WebTabRail({ pathname, unreadBadge }: {
  pathname: string;
  unreadBadge: string | undefined;
}): React.ReactElement {
  const pal = usePalette();
  return (
    <Col
      width={WEB_TAB_RAIL_WIDTH}
      margin={{ left: '-50vw' }}
      padding={{ top: 12 }}
      gap={4}
      surface="toolbar"
      style={{
        position: 'absolute', top: 0, bottom: 0, left: '50%',
        borderRightWidth: 1, borderRightColor: pal.border, zIndex: 3,
      }}
>
      <TabButtons pathname={pathname} unreadBadge={unreadBadge} vertical/>
    </Col>
  );
}
