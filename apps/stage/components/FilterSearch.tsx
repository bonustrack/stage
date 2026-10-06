import { useEffect, useRef } from 'react';
import { SearchTopnavBar } from './SearchTopnavBar';
import { useWebTabRail } from '../lib/webLayout';
import { getPeerDisplayName, getPeerHandle } from '../lib/peerProfiles';
import { memberNames, searchQueryText, setSearchQueryText } from './searchFilter.model';

export function memberNamesOf(address: string): string[] {
  return memberNames(getPeerHandle(address), getPeerDisplayName(address));
}

export function FilterSearch({ query, setQuery, onFocusChange, ...bar }: {
  query: string;
  setQuery: (query: string) => void;
  onFocusChange?: (focused: boolean) => void;
} & Omit<React.ComponentProps<typeof SearchTopnavBar>, 'query' | 'setQuery' | 'inputProps' | 'placeholder' | 'field'>): React.ReactElement {
  const wide = useWebTabRail();
  const focused = useRef(false);
  const reportFocus = (next: boolean): void => { focused.current = next; onFocusChange?.(next); };
  useEffect(() => () => { if (focused.current) onFocusChange?.(false); }, []);
  return (
    <SearchTopnavBar
      {...bar} inline={!wide || bar.inline === true} field={!wide} query={searchQueryText(query)}
      setQuery={text => { setQuery(setSearchQueryText(query, text)); }}
      inputProps={{
        accessibilityLabel: 'Search',
        onFocus: () => { reportFocus(true); },
        onBlur: () => { reportFocus(false); },
      }}
    />
  );
}
