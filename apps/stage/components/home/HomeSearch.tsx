import { useState } from 'react';
import { SearchField } from '../search/SearchField';
import { TopnavSearch } from '../search/TopnavSearch';
import { useWebTabRail } from '../layout/webLayout';
import type { HomeView } from '../../lib/homeView';
import { searchQueryText, setSearchQueryText } from './search/searchFilter.model';
import { useHomeQuery } from './listing';

const SEARCH_INPUT = { accessibilityLabel: 'Search' };

export function HomeSearch({
  view,
  inline,
  trailing,
  fieldAction,
  onOpen,
}: {
  view: HomeView;
  inline?: boolean;
  trailing?: React.ReactNode;
  fieldAction?: React.ReactNode;
  onOpen?: () => void;
}): React.ReactElement {
  const wide = useWebTabRail();
  const [query, setQuery] = useHomeQuery(view);
  const [key, setKey] = useState(0);
  const bar = {
    autoFocus: key > 0,
    query: searchQueryText(query),
    setQuery: (text: string): void => {
      setQuery(setSearchQueryText(query, text));
    },
    onClose: (): void => {
      setKey(0);
      setQuery(setSearchQueryText(query, ''));
    },
    onOpen: (): void => {
      onOpen?.();
      setKey((k) => k + 1);
    },
    inputProps: SEARCH_INPUT,
  };
  if (wide) return <TopnavSearch key={key} {...bar} inline={inline} persistent trailing={trailing} />;
  return <SearchField key={key} {...bar} inline fieldAction={fieldAction} />;
}
