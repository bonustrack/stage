import { useEffect, useMemo, useState } from 'react';
import type { NativeSyntheticEvent, TextInputKeyPressEventData, TextInputSelectionChangeEventData } from 'react-native';
import { DROPDOWN_MENU, DropdownMenu, DropdownMenuItem } from '@stage-labs/kit/react-native/menu';
import type { CentralIcon } from '@stage-labs/kit/react-native/glyph';
import { IconPeople } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconPeople';
import { IconTag } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconTag';
import { Box } from '../layout';
import { Avatar } from '../Avatar';
import { MENU_WIDTH } from '../AnchoredMenu';
import { MENU_GAP } from '../menuStyle';
import { SEARCH_TEXT_INSET, SearchTopnavBar } from '../SearchTopnavBar';
import { keepInputFocus } from '../composer/parts';
import { mentionKeyAction } from '../composer/mentions.model';
import { revealMarked } from '../arrowKeys';
import type { MarkedNode } from '../arrowKeys.model';
import { homeRows } from '../home/state';
import { shortAddress, subscribeCachedRows } from '../../modules/messaging';
import { useStoreValue } from '../../lib/storeCore';
import { getPeerDisplayName, getPeerHandle, getPeerName, usePeerProfiles } from '../../lib/peerProfiles';
import {
  boardFilterMenu, boardFilterMenuKey, boardFilterSources, filterMenuSize, memberNames, memberTokenValue, pickBoardFilter,
  type BoardFilterField, type FilterMenu, type FilterOption, type FilterOptions, type FilterSpan,
} from './boardFilter.model';

const FILTER_PLACEHOLDER = 'Filter by keyword or by field';
const MENU_MAX_HEIGHT = 360;
const FIELD_NAMES: Record<BoardFilterField, string> = { label: 'Label', member: 'Member' };
const FIELD_ICONS: Record<BoardFilterField, CentralIcon> = { label: IconTag, member: IconPeople };

const optionMark = (index: number): MarkedNode => ({ dataSet: { boardfilteroption: String(index) } });

export function memberNamesOf(address: string): string[] {
  return memberNames(getPeerHandle(address), getPeerDisplayName(address));
}

const byLabel = (a: FilterOption, b: FilterOption): number => a.label.localeCompare(b.label);

const NO_OPTIONS: FilterOptions = { label: [], member: [] };

function useFilterOptions(enabled: boolean): FilterOptions {
  const rows = useStoreValue(subscribeCachedRows, homeRows);
  const sources = useMemo(() => boardFilterSources(rows ?? []), [rows]);
  usePeerProfiles(enabled ? sources.members : []);
  if (!enabled) return NO_OPTIONS;
  return {
    label: sources.labels.map(label => ({ key: label, label, value: label })),
    member: sources.members.map(address => ({
      key: address,
      label: getPeerName(address) ?? shortAddress(address),
      value: memberTokenValue(address, getPeerHandle(address)),
    })).sort(byLabel),
  };
}

function shiftHeld(event: object): boolean {
  return 'shiftKey' in event && event.shiftKey === true;
}

function composing(event: object): boolean {
  return 'isComposing' in event && event.isComposing === true;
}

interface FilterInput {
  menu: FilterMenu | null;
  active: number;
  pick: (index: number) => void;
  onChangeText: (next: string) => void;
  inputProps: NonNullable<React.ComponentProps<typeof SearchTopnavBar>['inputProps']>;
}

function useFilterInput(query: string, setQuery: (query: string) => void, enabled: boolean): FilterInput {
  const [focused, setFocused] = useState(false);
  const [caret, setCaret] = useState(query.length);
  const [selection, setSelection] = useState<FilterSpan | undefined>(undefined);
  const [dismissed, setDismissed] = useState(false);
  const [active, setActive] = useState({ key: '', index: 0 });
  const options = useFilterOptions(enabled);
  const found = enabled && focused ? boardFilterMenu(query, Math.min(caret, query.length), options) : null;
  const menu = dismissed ? null : found;
  const menuKey = `${boardFilterMenuKey(menu)}|${query}`;
  const index = active.key === menuKey ? Math.min(active.index, filterMenuSize(menu) - 1) : 0;
  const pick = (at: number): void => {
    const next = menu === null ? null : pickBoardFilter(query, menu, at);
    if (next === null) return;
    setQuery(next.query);
    setCaret(next.caret);
    setSelection({ start: next.caret, end: next.caret });
  };
  const onKeyPress = (event: NativeSyntheticEvent<TextInputKeyPressEventData>): void => {
    if (composing(event.nativeEvent)) return;
    const action = mentionKeyAction(event.nativeEvent.key, shiftHeld(event.nativeEvent), filterMenuSize(menu), index);
    if (action === null) return;
    event.preventDefault();
    if (action.kind === 'move') {
      setActive({ key: menuKey, index: action.index });
      revealMarked(optionMark(action.index));
    } else if (action.kind === 'dismiss') setDismissed(true);
    else pick(index);
  };
  const onSelectionChange = (event: NativeSyntheticEvent<TextInputSelectionChangeEventData>): void => {
    setCaret(event.nativeEvent.selection.end);
  };
  const onChangeText = (next: string): void => {
    setCaret(Math.max(0, Math.min(next.length, caret + next.length - query.length)));
    setDismissed(false);
    setQuery(next);
  };
  const inputProps = enabled ? {
    selection, onKeyPress, onSelectionChange,
    onFocus: () => { setFocused(true); setDismissed(false); },
    onBlur: () => { setFocused(false); },
  } : {};
  return { menu, active: index, pick, onChangeText, inputProps };
}

function FilterMenuItems({ menu, active, onPick }: {
  menu: FilterMenu; active: number; onPick: (index: number) => void;
}): React.ReactElement {
  if (menu.kind === 'fields') {
    return <>{menu.fields.map((field, i) => (
      <Box key={field} {...optionMark(i)}>
        <DropdownMenuItem
          label={FIELD_NAMES[field]} iconName={FIELD_ICONS[field]} highlighted={i === active}
          onPress={() => { onPick(i); }}
        />
      </Box>
    ))}</>;
  }
  const member = menu.field === 'member';
  return <>{menu.options.map((option, i) => (
    <Box key={option.key} {...optionMark(i)}>
      <DropdownMenuItem
        label={option.label}
        iconName={member ? undefined : IconTag}
        icon={member ? <Avatar address={option.key} size={DROPDOWN_MENU.icon}/> : undefined}
        highlighted={i === active}
        onPress={() => { onPick(i); }}
      />
    </Box>
  ))}</>;
}

export function BoardSearch({ query, setQuery, wide, onMenu, ...bar }: {
  query: string;
  setQuery: (query: string) => void;
  wide: boolean;
  onMenu: (open: boolean) => void;
} & Omit<React.ComponentProps<typeof SearchTopnavBar>, 'query' | 'setQuery' | 'inputProps' | 'placeholder'>): React.ReactElement {
  const filter = useFilterInput(query, setQuery, wide);
  const open = filter.menu !== null;
  useEffect(() => { onMenu(open); }, [open]);
  useEffect(() => () => { onMenu(false); }, []);
  if (!wide) return <SearchTopnavBar {...bar} query={query} setQuery={setQuery}/>;
  return (
    <Box style={{ position: 'relative', zIndex: 5 }}>
      <SearchTopnavBar
        {...bar} query={query} setQuery={filter.onChangeText} inputProps={filter.inputProps} placeholder={FILTER_PLACEHOLDER}
      />
      {filter.menu === null ? null : (
        <Box margin={{ top: MENU_GAP }} style={{ position: 'absolute', top: '100%', left: SEARCH_TEXT_INSET }} {...keepInputFocus}>
          <DropdownMenu maxHeight={MENU_MAX_HEIGHT} style={{ width: MENU_WIDTH }}>
            <FilterMenuItems menu={filter.menu} active={filter.active} onPick={filter.pick}/>
          </DropdownMenu>
        </Box>
      )}
    </Box>
  );
}
