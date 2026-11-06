import { useCallback, useState } from 'react';
import { SearchField } from '../search/SearchField';
import { TopnavSearch } from '../search/TopnavSearch';
import { useWebTabRail } from '../layout/webLayout';
import type { HomeView } from '../../lib/homeView';
import { searchQueryText, setSearchQueryText } from './search/searchFilter.model';
import { useHomeQuery } from './listing';

const SEARCH_INPUT = { accessibilityLabel: 'Search' };

interface SearchOpen {
  key: number;
  open: () => void;
  close: () => void;
}

function useSearchOpen(query: string, setQuery: (query: string) => void): SearchOpen {
  const [key, setKey] = useState(0);
  const open = useCallback(() => {
    setKey((k) => k + 1);
  }, []);
  return {
    key,
    open,
    close: () => {
      setKey(0);
      setQuery(setSearchQueryText(query, ''));
    },
  };
}

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
  const search = useSearchOpen(query, setQuery);
  const bar = {
    autoFocus: search.key > 0,
    query: searchQueryText(query),
    setQuery: (text: string): void => {
      setQuery(setSearchQueryText(query, text));
    },
    onClose: search.close,
    onOpen: (): void => {
      onOpen?.();
      search.open();
    },
    inputProps: SEARCH_INPUT,
  };
  if (wide) return <TopnavSearch key={search.key} {...bar} inline={inline} persistent trailing={trailing} />;
  return <SearchField key={search.key} {...bar} inline fieldAction={fieldAction} />;
}
