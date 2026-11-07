import { usePathname } from 'expo-router';
import { Text } from '@stage-labs/kit/react-native/text';
import { Tabs } from '../../lib/navigation';
import { useAccountGate } from '../../lib/accountGate';
import { useSafeAreaInsets } from '../layout/safeArea';
import { TAB_BAR_HEIGHT } from '../layout/webChrome.core';
import { useWebTabRail } from '../layout/webLayout';
import { Topnav } from '../Topnav';
import { HomeTopnav } from '../home/HomeTopnav';
import { Landing } from '../landing/Landing';
import { TabsPager } from './TabsPager';
import { WebTabBar, WebTabRail } from './WebTabRail';
import { useRememberHomeView } from './boardHome';
import { homeViewAt } from './splitRoutes';
import { HIDDEN_TAB_ROUTES, TAB_BAR_PAGES, tabPageAt } from './pages';
import { routeRendersPage } from './pageRenderer';
import { Column } from '../layout';

function HoistedTopnav({ rail, pathname }: { rail: boolean; pathname: string }): React.ReactElement {
  const home = homeViewAt(pathname);
  if (home !== null) return <HomeTopnav view={home} pane={false} />;
  const title = rail ? tabPageAt(pathname)?.label : undefined;
  const left = title === undefined ? undefined : <Text text={title} size="xl" fontWeight="semibold" />;
  return <Topnav left={left} />;
}

function PagerOverlay({
  insetTop,
  tabBarHeight,
  rail,
  pathname,
}: {
  insetTop: number;
  tabBarHeight: number;
  rail: boolean;
  pathname: string;
}): React.ReactElement | null {
  if (routeRendersPage(pathname)) return null;
  return (
    <Column weight={1} padding={{ top: insetTop, bottom: tabBarHeight }}>
      {rail && homeViewAt(pathname) !== null ? null : <HoistedTopnav rail={rail} pathname={pathname} />}
      <TabsPager />
    </Column>
  );
}

export function TabsShell(): React.ReactElement {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const rail = useWebTabRail();
  const gate = useAccountGate();
  useRememberHomeView();

  if (gate.ready && !gate.hasAccount) return <Landing />;

  return (
    <Column surface="surface" weight={1}>
      <Tabs>
        {TAB_BAR_PAGES.map((page) => (
          <Tabs.Screen key={page.tabRoute} name={page.tabRoute} />
        ))}
        <Tabs.Screen name="account" />
        {HIDDEN_TAB_ROUTES.map((name) => (
          <Tabs.Screen key={name} name={name} />
        ))}
      </Tabs>
      <PagerOverlay insetTop={insets.top} tabBarHeight={rail ? 0 : TAB_BAR_HEIGHT + insets.bottom} rail={rail} pathname={pathname} />
      {rail ? <WebTabRail pathname={pathname} /> : <WebTabBar pathname={pathname} />}
    </Column>
  );
}
