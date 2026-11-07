import { usePathname } from 'expo-router';
import { PAGES } from './SwipeTabs.config';
import { homePageName } from './SwipeTabs.model';
import { useBoardHome } from './tabs/boardHome';
import { Column } from './layout';

export function TabsPager(): React.ReactElement {
  const name = homePageName(usePathname(), useBoardHome());
  const Body = PAGES[name];
  return (
    <Column weight={1}>
      <Body />
    </Column>
  );
}
