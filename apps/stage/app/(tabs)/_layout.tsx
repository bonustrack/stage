
import { Box, Col, Row, WEB_CHROME_WIDTH } from '../../components/layout';
import { fontSize } from '@stage-labs/kit/tokens';
import { Tabs, usePathname, useRouter } from 'expo-router';
import { Platform } from 'react-native';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Text } from '@stage-labs/kit/react-native/text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type HeroIconName } from '@stage-labs/kit/react-native/icon';
import { usePalette } from '../../lib/theme';
import { TabsPager } from '../../components/SwipeTabs';
import { TAB_HREF, indexOfPathname, type TabName } from '../../components/SwipeTabs.config';
import { HoistedTopnav } from '../../components/tabs/HoistedTopnav';
import { useTotalUnread } from '../../lib/useTotalUnread';
import { unreadBadgeLabel } from '../../lib/format';

const TAB_ICONS: readonly (readonly [TabName, HeroIconName])[] = [
  ['index', 'chatBubble'],
  ['contacts', 'users'],
  ['wallet', 'wallet'],
];

function WebTabBar({ pathname, unreadBadge }: {
  pathname: string;
  unreadBadge: string | undefined;
}): React.ReactElement {
  const router = useRouter();
  const pal = usePalette();
  const activeIndex = pathname.startsWith('/settings') ? -1 : indexOfPathname(pathname);
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
      {TAB_ICONS.map(([name, icon], i) => (
        <Pressable
          key={name}
          onPress={() => { router.navigate(TAB_HREF[name]); }}
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
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
    </Row>
  );
}

function PagerOverlay({ insetTop, tabBarHeight }: { insetTop: number; tabBarHeight: number }): React.ReactElement {
  if (Platform.OS === 'web') {
    return (
      <Col
        pointerEvents="box-none"
        width="100vw"
        margin={{ left: '-50vw' }}
        style={{ position: 'absolute', top: 0, bottom: 0, left: '50%' }}
>
        {}
        <Box pointerEvents="box-none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
          <TabsPager/>
        </Box>
        {}
        <Box pointerEvents="box-none" style={{ position: 'absolute', top: insetTop, left: 0, right: 0, zIndex: 2 }}>
          <HoistedTopnav/>
        </Box>
      </Col>
    );
  }
  return (
    <Col
      pointerEvents="box-none"
      style={{ position: 'absolute', top: insetTop, bottom: tabBarHeight, left: 0, right: 0 }}
>
      {}
      <HoistedTopnav/>
      {}
      <Box flex={1}>
        <TabsPager/>
      </Box>
    </Col>
  );
}

export default function TabsLayout(): React.ReactElement {
  const pathname = usePathname();
  const unread = useTotalUnread();
  const unreadBadge = unreadBadgeLabel(unread);
  const pagerVisible = !pathname.startsWith('/settings');
  const insets = useSafeAreaInsets();
  const pal = usePalette();
  const active = pal.link;
  const inactive = pal.text;
  const web = Platform.OS === 'web';

  const tabBarStyle = {
    backgroundColor: pal.toolbarBg,
    borderTopWidth: 1,
    borderTopColor: pal.border,
    elevation: 0,
    shadowOpacity: 0,
    height: 60 + insets.bottom,
    paddingTop: 6,
    paddingBottom: insets.bottom,
    ...(web ? { display: 'none' as const } : {}),
  };

  const tabBarHeight = 60 + insets.bottom;

  return (
    <Col surface="surface" flex={1}>
      {}
      <Box height={insets.top} surface="toolbar"
        pointerEvents="none"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1 }}
/>
      {}
      <Tabs
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: 'transparent' },
          tabBarStyle,
          tabBarActiveTintColor: active,
          tabBarInactiveTintColor: inactive,
          tabBarShowLabel: false,
        }}
>
        {TAB_ICONS.map(([name, icon]) => (
          <Tabs.Screen
            key={name}
            name={name}
            options={{
              tabBarIcon: ({ color, focused }) => (
                <Icon name={icon} size={26} color={color} focused={focused}/>
              ),
              ...(name === 'index'
                ? {
                    tabBarBadge: unreadBadge,
                    tabBarBadgeStyle: {
                      backgroundColor: pal.link,
                      color: pal.bg,
                      fontSize: fontSize('3xs'),
                      fontFamily: 'Calibre-Semibold',
                      minWidth: 18,
                      height: 18,
                      lineHeight: 18,
                    },
                  }
                : {}),
            }}
/>
        ))}
        {}
        <Tabs.Screen name="settings" options={{ href: null }}/>
      </Tabs>
      {}
      {pagerVisible ? <PagerOverlay insetTop={insets.top} tabBarHeight={tabBarHeight}/> : null}
      {}
      {web ? <WebTabBar pathname={pathname} unreadBadge={unreadBadge}/> : null}
    </Col>
  );
}
