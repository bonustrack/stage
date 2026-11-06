import { usePathname } from 'expo-router';
import { PAGER_SCREENS } from './pagerScreens';
import { PAGER_ORDER, homeTabIndex } from './pages';
import { useBoardHome } from './boardHome';
import { Column } from '../layout';

export function TabsPager(): React.ReactElement {
  const id = PAGER_ORDER[homeTabIndex(usePathname(), useBoardHome())] ?? 'chats';
  const Body = PAGER_SCREENS[id];
  return (
    <Column weight={1}>
      <Body />
    </Column>
  );
}
