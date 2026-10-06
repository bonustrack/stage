import { SearchTopnavBar } from './SearchTopnavBar';
import { useWebTabRail } from '../lib/webLayout';
import { getPeerDisplayName, getPeerHandle } from '../lib/peerProfiles';
import { memberNames, searchQueryText, setSearchQueryText } from './searchFilter.model';

export function memberNamesOf(address: string): string[] {
  return memberNames(getPeerHandle(address), getPeerDisplayName(address));
}

export function FilterSearch({ query, setQuery, ...bar }: {
  query: string;
  setQuery: (query: string) => void;
} & Omit<React.ComponentProps<typeof SearchTopnavBar>, 'query' | 'setQuery' | 'inputProps' | 'placeholder' | 'field'>): React.ReactElement {
  const wide = useWebTabRail();
  return (
    <SearchTopnavBar
      {...bar} inline={!wide || bar.inline === true} field={!wide} persistent={wide} query={searchQueryText(query)}
      setQuery={text => { setQuery(setSearchQueryText(query, text)); }}
      inputProps={{ accessibilityLabel: 'Search' }}
    />
  );
}
