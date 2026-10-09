import { usePathname } from 'expo-router';
import { Col } from './layout';
import { PAGES, TAB_ORDER, homeTabIndex } from './SwipeTabs.config';
import { useBoardHome } from './tabs/boardHome';

export function TabsPager(): React.ReactElement {
  const name = TAB_ORDER[homeTabIndex(usePathname(), useBoardHome())] ?? 'index';
  const Body = PAGES[name];
  return (
    <Col flex={1}>
      <Body/>
    </Col>
  );
}
