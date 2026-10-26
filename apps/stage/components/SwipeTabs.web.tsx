import { usePathname } from 'expo-router';
import { PAGES, TAB_ORDER, homeTabIndex } from './SwipeTabs.config';
import { useBoardHome } from './tabs/boardHome';
import { Column } from './layout';

export function TabsPager(): React.ReactElement {
  const name = TAB_ORDER[homeTabIndex(usePathname(), useBoardHome())] ?? 'index';
  const Body = PAGES[name];
  return (
    <Column weight={1}>
      <Body/>
    </Column>
  );
}
