import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Platform, useWindowDimensions,
  type NativeSyntheticEvent, type TextInputKeyPressEventData, type TextInputSelectionChangeEventData,
} from 'react-native';
import { useKeyboardState } from 'react-native-keyboard-controller';
import { isRowCleared } from '@stage-labs/client/xmtp/readState';
import { DROPDOWN_MENU, DropdownMenu, DropdownMenuItem } from '@stage-labs/kit/react-native/menu';
import { Scroll } from '@stage-labs/kit/react-native/scroll';
import type { CentralIcon } from '@stage-labs/kit/react-native/glyph';
import { IconCircleMinus } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconCircleMinus';
import { IconPeople } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconPeople';
import { IconFilter1 } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconFilter1';
import { IconPencil } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconPencil';
import { IconTag } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconTag';
import { Box, PAGE_GUTTER, STICKY_UNDER_CHROME } from './layout';
import { Avatar } from './Avatar';
import { AccountAvatar } from './AccountAvatarButton';
import { MENU_WIDTH } from './AnchoredMenu';
import { MENU_GAP } from './menuStyle';
import { SearchTopnavBar, SEARCH_FIELD_HEIGHT } from './SearchTopnavBar';
import { TOPNAV_FADE, TOPNAV_HEIGHT } from './Topnav';
import { keepInputFocus } from './composer/parts';
import { mentionKeyAction } from './composer/mentions.model';
import { revealMarked } from './arrowKeys';
import type { MarkedNode } from './arrowKeys.model';
import { homeRows } from './home/state';
import { subscribeCachedRows } from '../modules/messaging';
import { useStoreValue } from '../lib/storeCore';
import { useClearedChats } from '../lib/clearedChats';
import { useSafeAreaInsets } from '../lib/safeArea';
import { useWebTabRail } from '../lib/webLayout';
import { getPeerDisplayName, getPeerHandle, usePeerProfiles } from '../lib/peerProfiles';
import {
  HAS_OPTIONS, ME_OPTION, ME_VALUE, filterMenuKey, filterMenuSize, memberNames, memberTokenValue, pickSearchFilter,
  searchFilterMenu, searchFilterSources,
  type FilterField, type FilterMenu, type FilterOption, type FilterOptions, type FilterScope, type FilterSpan,
} from './searchFilter.model';
import { peerLabel } from './conversation/convTitle';

const MENU_MAX_HEIGHT = 360;
const FILTER_LAYER = { zIndex: 5 };
const RELATIVE = { position: 'relative' } as const;
const FIELD_LAYER = { ...RELATIVE, zIndex: 1 };
const NATIVE = Platform.OS !== 'web';
const FIELD_NAMES: Record<FilterField, string> = { label: 'Label', member: 'Member', has: 'Has' };
const FIELD_ICONS: Record<FilterField, CentralIcon> = { label: IconTag, member: IconPeople, has: IconFilter1 };

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
    has: HAS_OPTIONS,
    label: sources.labels.map(label => ({ key: label, label, value: label })),
    member: [ME_OPTION, ...sources.members.map(address => ({
      key: address,
      label: peerLabel(address),
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

interface FilterInputOptions {
  enabled: boolean;
  resting: number;
  onFocusChange?: (focused: boolean) => void;
}

function useFilterInput(
  query: string, setQuery: (query: string) => void, options: FilterOptions, { enabled, resting, onFocusChange }: FilterInputOptions,
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
    onFocus: () => { setFocused(true); setDismissed(false); onFocusChange?.(true); },
    onBlur: () => { setFocused(false); onFocusChange?.(false); },
  };
  return { menu, active: index, pick, onChangeText, inputProps };
}

function optionIcon(field: FilterField, option: FilterOption, excluded: boolean): CentralIcon {
  if (excluded) return IconCircleMinus;
  return field === 'has' && option.value === 'draft' ? IconPencil : IconTag;
}

function FilterOptionItem({ field, option, excluded, highlighted, onPress }: {
  field: FilterField; option: FilterOption; excluded: boolean; highlighted: boolean; onPress: () => void;
}): React.ReactElement {
  const member = field === 'member';
  const avatar = option.key === ME_VALUE
    ? <AccountAvatar size={DROPDOWN_MENU.icon}/>
    : <Avatar address={option.key} size={DROPDOWN_MENU.icon}/>;
  return (
    <DropdownMenuItem
      label={option.label}
      iconName={member ? undefined : optionIcon(field, option, excluded)}
      icon={member ? avatar : undefined}
      highlighted={highlighted}
      onPress={onPress}
    />
  );
}

const excludeName = (field: FilterField): string => `Exclude ${FIELD_NAMES[field].toLowerCase()}`;

function FieldItem({ field, negated, index, active, onPick }: {
  field: FilterField; negated: boolean; index: number; active: number; onPick: (index: number) => void;
}): React.ReactElement {
  return (
    <Box {...optionMark(index)}>
      <DropdownMenuItem
        label={negated ? excludeName(field) : FIELD_NAMES[field]}
        iconName={negated ? IconCircleMinus : FIELD_ICONS[field]}
        highlighted={index === active}
        onPress={() => { onPick(index); }}
      />
    </Box>
  );
}

function FilterMenuItems({ menu, active, onPick }: {
  menu: FilterMenu; active: number; onPick: (index: number) => void;
}): React.ReactElement {
  if (menu.kind === 'fields') {
    return <>{menu.fields.map((field, i) => (
      <FieldItem key={field} field={field} negated={menu.negated} index={i} active={active} onPick={onPick}/>
    ))}</>;
  }
  const { field, negated, excludeRow } = menu;
  const first = excludeRow ? 1 : 0;
  return <>
    {excludeRow ? <FieldItem field={field} negated index={0} active={active} onPick={onPick}/> : null}
    {menu.options.map((option, i) => (
      <Box key={option.key} {...optionMark(first + i)}>
        <FilterOptionItem
          field={field} option={option} excluded={negated}
          highlighted={first + i === active} onPress={() => { onPick(first + i); }}
        />
      </Box>
    ))}
  </>;
}

function useTouchMenuHeight(): number {
  const { height } = useWindowDimensions();
  const keyboard = useKeyboardState(state => (state.isVisible ? state.height : 0));
  const top = useSafeAreaInsets().top + TOPNAV_HEIGHT + TOPNAV_FADE + SEARCH_FIELD_HEIGHT;
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
    <Box margin={{ top: MENU_GAP }} style={{ position: 'absolute', top: '100%', left: PAGE_GUTTER }} {...keepInputFocus}>
      <DropdownMenu maxHeight={MENU_MAX_HEIGHT} style={{ width: MENU_WIDTH }}>{children}</DropdownMenu>
    </Box>
  );
}

export function FilterSearch({ query, setQuery, scope, onMenu, onFocusChange, ...bar }: {
  query: string;
  setQuery: (query: string) => void;
  scope: FilterScope;
  onMenu: (open: boolean) => void;
  onFocusChange?: (focused: boolean) => void;
} & Omit<React.ComponentProps<typeof SearchTopnavBar>, 'query' | 'setQuery' | 'inputProps' | 'placeholder' | 'field'>): React.ReactElement {
  const wide = useWebTabRail();
  const keyboardUp = useKeyboardState(state => state.isVisible);
  const options = useFilterOptions(scope);
  const focused = useRef(false);
  const reportFocus = (next: boolean): void => { focused.current = next; onFocusChange?.(next); };
  const filter = useFilterInput(query, setQuery, options, { enabled: !NATIVE || keyboardUp, resting: wide ? 0 : -1, onFocusChange: reportFocus });
  const open = filter.menu !== null;
  useEffect(() => { onMenu(open); }, [open]);
  useEffect(() => () => { onMenu(false); if (focused.current) onFocusChange?.(false); }, []);
  const Menu = wide ? WideFilterMenu : TouchFilterMenu;
  const layer = wide ? [bar.inline === true ? RELATIVE : STICKY_UNDER_CHROME, FILTER_LAYER] : FIELD_LAYER;
  return (
    <Box style={layer}>
      <SearchTopnavBar
        {...bar} inline field={!wide} query={query} setQuery={filter.onChangeText} inputProps={filter.inputProps}
      />
      {filter.menu === null ? null : (
        <Menu>
          <FilterMenuItems menu={filter.menu} active={filter.active} onPick={filter.pick}/>
        </Menu>
      )}
    </Box>
  );
}
