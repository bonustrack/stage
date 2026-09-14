import { usePathname } from 'expo-router';
import { Col } from './layout';
import { PAGES, TAB_ORDER, indexOfPathname } from './SwipeTabs.config';

export function TabsPager(): React.ReactElement {
  const pathname = usePathname();
  const name = TAB_ORDER[indexOfPathname(pathname)] ?? 'index';
  const Body = PAGES[name];
  return (
    <Col flex={1}>
      <Body/>
    </Col>
  );
}
