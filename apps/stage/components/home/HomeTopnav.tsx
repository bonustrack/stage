import { useEffect, useMemo, useState } from 'react';
import type { MenuPoint } from '../AnchoredMenu.model';
import { Topnav } from '../Topnav';
import { useWebTabRail } from '../layout/webLayout';
import { usePalette } from '../../lib/theme';
import { useAccountEpoch } from '../../lib/accountEpoch';
import type { HomeView } from '../../lib/homeView';
import { HomeTopnavRight } from './topnavRight';
import { HomeSearch } from './HomeSearch';
import type { HomeMenuState } from './viewMenu';

function useHomeMenu(): HomeMenuState {
  const accountEpoch = useAccountEpoch();
  const [anchor, setAnchor] = useState<MenuPoint | null>(null);
  useEffect(() => {
    setAnchor(null);
  }, [accountEpoch]);
  return useMemo(() => ({ anchor, setAnchor }), [anchor]);
}

export function HomeTopnav({ view, pane }: { view: HomeView; pane: boolean }): React.ReactElement {
  const wide = useWebTabRail();
  const menu = useHomeMenu();
  const { text } = usePalette();
  const right = <HomeTopnavRight head={text} view={view} menu={menu} />;
  if (!wide) return <Topnav inline={pane} right={right} bordered={false} />;
  return <HomeSearch view={view} inline={pane} trailing={right} />;
}
