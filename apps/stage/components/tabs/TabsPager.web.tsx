import { usePathname } from 'expo-router';
import { PAGER_SCREENS } from './pagerScreens';
import { shownPagerPage } from './pages';
import { useBoardHome } from './boardHome';
import { Column } from '../layout';

export function TabsPager(): React.ReactElement {
  const Body = PAGER_SCREENS[shownPagerPage(usePathname(), useBoardHome())];
  return (
    <Column weight={1}>
      <Body />
    </Column>
  );
}
