import { useEffect, useMemo, useState } from 'react';
import {
  Platform, useWindowDimensions,
  type NativeSyntheticEvent, type TextInputKeyPressEventData, type TextInputSelectionChangeEventData,
} from 'react-native';
import { useKeyboardState } from 'react-native-keyboard-controller';
import { isRowCleared } from '@stage-labs/client/xmtp/readState';
import { DROPDOWN_MENU, DropdownMenu, DropdownMenuItem } from '@stage-labs/kit/react-native/menu';
import { Scroll } from '@stage-labs/kit/react-native/scroll';
import type { CentralIcon } from '@stage-labs/kit/react-native/glyph';
import { IconPeople } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconPeople';
import { IconTag } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconTag';
import { Box, STICKY_UNDER_CHROME } from './layout';
import { Avatar } from './Avatar';
import { AccountAvatar } from './AccountAvatarButton';
import { MENU_WIDTH } from './AnchoredMenu';
import { MENU_GAP } from './menuStyle';
import { SEARCH_TEXT_INSET, SearchTopnavBar } from './SearchTopnavBar';
import { TOPNAV_HEIGHT } from './Topnav';
import { keepInputFocus } from './composer/parts';
import { mentionKeyAction } from './composer/mentions.model';
import { revealMarked } from './arrowKeys';
import type { MarkedNode } from './arrowKeys.model';
import { homeRows } from './home/state';
import { shortAddress, subscribeCachedRows } from '../modules/messaging';
import { useStoreValue } from '../lib/storeCore';
import { useClearedChats } from '../lib/clearedChats';
import { useSafeAreaInsets } from '../lib/safeArea';
import { useWebTabRail } from '../lib/webLayout';
import { getPeerDisplayName, getPeerHandle, getPeerName, usePeerProfiles } from '../lib/peerProfiles';
import {
  ME_OPTION, ME_VALUE, filterMenuKey, filterMenuSize, isFilterOptionPicked, memberNames, memberTokenValue, pickSearchFilter,
  searchFilterMenu, searchFilterSources,
  type FilterField, type FilterMenu, type FilterOption, type FilterOptions, type FilterScope, type FilterSpan,
} from './searchFilter.model';

const FILTER_PLACEHOLDER = 'Filter by keyword or by field';
const MENU_MAX_HEIGHT = 360;
const FILTER_LAYER = 5;
const NATIVE = Platform.OS !== 'web';
const FIELD_NAMES: Record<FilterField, string> = { label: 'Label', member: 'Member' };
const FIELD_ICONS: Record<FilterField, CentralIcon> = { label: IconTag, member: IconPeople };

const optionMark = (index: number): MarkedNode => ({ dataSet: { filteroption: String(index) } });

export function memberNamesOf(address: string): string[] {
  return memberNames(getPeerHandle(address), getPeerDisplayName(address));
}

const byLabel = (a: FilterOption, b: FilterOption): number => a.label.localeCompare(b.label);

function useFilterOptions(scope: FilterScope): FilterOptions {
  const rows = useStoreValue(subscribeCachedRows, homeRows);
  const cleared = useClearedChats();
  const sources = useMemo(
    () => searchFilterSources((rows ?? []).filter(row => !isRowCleared(cleared, row)), scope),
    [rows, cleared, scope],
  );
  usePeerProfiles(sources.members);
  return {
    label: sources.labels.map(label => ({ key: label, label, value: label })),
    member: [ME_OPTION, ...sources.members.map(address => ({
      key: address,
      label: getPeerName(address) ?? shortAddress(address),
      value: memberTokenValue(address, getPeerHandle(address)),
    })).sort(byLabel)],
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

function useFilterInput(
  query: string, setQuery: (query: string) => void, options: FilterOptions, { enabled, resting }: { enabled: boolean; resting: number },
): FilterInput {
  const [focused, setFocused] = useState(false);
  const [caret, setCaret] = useState(query.length);
  const [selection, setSelection] = useState<FilterSpan | undefined>(undefined);
  const [dismissed, setDismissed] = useState(false);
  const [active, setActive] = useState({ key: '', index: 0 });
  const found = enabled && focused ? searchFilterMenu(query, Math.min(caret, query.length), options) : null;
  const menu = dismissed ? null : found;
  const menuKey = `${filterMenuKey(menu)}|${query}`;
  const index = active.key === menuKey ? Math.min(active.index, filterMenuSize(menu) - 1) : resting;
  const pick = (at: number): void => {
    const next = menu === null ? null : pickSearchFilter(query, menu, at);
    if (next === null) return;
    setQuery(next.query);
    setCaret(next.caret);
    setSelection({ start: next.caret, end: next.caret });
  };
  const onKeyPress = (event: NativeSyntheticEvent<TextInputKeyPressEventData>): void => {
    if (composing(event.nativeEvent)) return;
    const { key } = event.nativeEvent;
    const from = index < 0 && key === 'ArrowUp' ? 0 : index;
    const action = mentionKeyAction(key, shiftHeld(event.nativeEvent), filterMenuSize(menu), from);
    if (action === null || (action.kind === 'pick' && index < 0)) return;
    event.preventDefault();
    if (action.kind === 'move') {
      setActive({ key: menuKey, index: action.index });
      revealMarked(optionMark(action.index));
    } else if (action.kind === 'dismiss') setDismissed(true);
    else pick(index);
  };
  const onSelectionChange = (event: NativeSyntheticEvent<TextInputSelectionChangeEventData>): void => {
    setCaret(event.nativeEvent.selection.end);
    setSelection(undefined);
  };
  const onChangeText = (next: string): void => {
    setCaret(Math.max(0, Math.min(next.length, caret + next.length - query.length)));
    setDismissed(false);
    setQuery(next);
  };
  const inputProps = {
    selection, onKeyPress, onSelectionChange,
    onFocus: () => { setFocused(true); setDismissed(false); },
    onBlur: () => { setFocused(false); },
  };
  return { menu, active: index, pick, onChangeText, inputProps };
}

function FilterOptionItem({ field, option, highlighted, selected, onPress }: {
  field: FilterField; option: FilterOption; highlighted: boolean; selected: boolean; onPress: () => void;
}): React.ReactElement {
  const member = field === 'member';
  const avatar = option.key === ME_VALUE
    ? <AccountAvatar size={DROPDOWN_MENU.icon}/>
    : <Avatar address={option.key} size={DROPDOWN_MENU.icon}/>;
  return (
    <DropdownMenuItem
      label={option.label}
      iconName={member ? undefined : IconTag}
      icon={member ? avatar : undefined}
      highlighted={highlighted}
      selected={selected}
      onPress={onPress}
    />
  );
}

function FilterMenuItems({ menu, query, active, onPick }: {
  menu: FilterMenu; query: string; active: number; onPick: (index: number) => void;
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
  const { field } = menu;
  return <>{menu.options.map((option, i) => (
    <Box key={option.key} {...optionMark(i)}>
      <FilterOptionItem
        field={field} option={option} highlighted={i === active} selected={isFilterOptionPicked(query, menu, option)}
        onPress={() => { onPick(i); }}
      />
    </Box>
  ))}</>;
}

function useTouchMenuHeight(): number {
  const { height } = useWindowDimensions();
  const keyboard = useKeyboardState(state => (state.isVisible ? state.height : 0));
  const top = useSafeAreaInsets().top + TOPNAV_HEIGHT;
  return Math.max(0, height - keyboard - top - MENU_GAP - DROPDOWN_MENU.padY * 2);
}

function TouchFilterMenu({ children }: { children: React.ReactNode }): React.ReactElement {
  const maxHeight = useTouchMenuHeight();
  return (
    <Box style={{ position: 'absolute', top: '100%', left: 0, right: 0 }} {...keepInputFocus}>
      <DropdownMenu style={{ alignSelf: 'stretch', borderRadius: 0 }}>
        <Scroll style={{ maxHeight }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {children}
        </Scroll>
      </DropdownMenu>
    </Box>
  );
}

function WideFilterMenu({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <Box margin={{ top: MENU_GAP }} style={{ position: 'absolute', top: '100%', left: SEARCH_TEXT_INSET }} {...keepInputFocus}>
      <DropdownMenu maxHeight={MENU_MAX_HEIGHT} style={{ width: MENU_WIDTH }}>{children}</DropdownMenu>
    </Box>
  );
}

export function FilterSearch({ query, setQuery, scope, onMenu, ...bar }: {
  query: string;
  setQuery: (query: string) => void;
  scope: FilterScope;
  onMenu: (open: boolean) => void;
} & Omit<React.ComponentProps<typeof SearchTopnavBar>, 'query' | 'setQuery' | 'inputProps' | 'placeholder'>): React.ReactElement {
  const wide = useWebTabRail();
  const keyboardUp = useKeyboardState(state => state.isVisible);
  const options = useFilterOptions(scope);
  const filter = useFilterInput(query, setQuery, options, { enabled: !NATIVE || keyboardUp, resting: wide ? 0 : -1 });
  const open = filter.menu !== null;
  useEffect(() => { onMenu(open); }, [open]);
  useEffect(() => () => { onMenu(false); }, []);
  const Menu = wide ? WideFilterMenu : TouchFilterMenu;
  return (
    <Box style={[bar.inline === true ? { position: 'relative' } : STICKY_UNDER_CHROME, { zIndex: FILTER_LAYER }]}>
      <SearchTopnavBar
        {...bar} inline query={query} setQuery={filter.onChangeText} inputProps={filter.inputProps}
        placeholder={wide ? FILTER_PLACEHOLDER : undefined}
      />
      {filter.menu === null ? null : (
        <Menu>
          <FilterMenuItems menu={filter.menu} query={query} active={filter.active} onPick={filter.pick}/>
        </Menu>
      )}
    </Box>
  );
}
