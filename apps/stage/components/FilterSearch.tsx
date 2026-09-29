import { useEffect, useMemo, useState } from 'react';
import { Keyboard, type GestureResponderEvent, type NativeSyntheticEvent, type TextInputKeyPressEventData, type TextInputSelectionChangeEventData } from 'react-native';
import { isRowCleared } from '@stage-labs/client/xmtp/readState';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { DROPDOWN_MENU, DropdownMenu, DropdownMenuItem } from '@stage-labs/kit/react-native/menu';
import { Glyph, type CentralIcon } from '@stage-labs/kit/react-native/glyph';
import { IconChevronBottom } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconChevronBottom';
import { IconPeople } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconPeople';
import { IconTag } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconTag';
import { Box, LIST_TOP_GAP, PAGE_GUTTER, Row, STICKY_UNDER_CHROME } from './layout';
import { Avatar } from './Avatar';
import { AnchoredMenu, MENU_WIDTH, menuPointBelow } from './AnchoredMenu';
import type { MenuPoint } from './AnchoredMenu.model';
import { LABEL_CHIP_ICON_SIZE, LabelChip } from './LabelChip';
import { MENU_GAP } from './menuStyle';
import { SEARCH_TEXT_INSET, SearchTopnavBar } from './SearchTopnavBar';
import { keepInputFocus } from './composer/parts';
import { mentionKeyAction } from './composer/mentions.model';
import { revealMarked } from './arrowKeys';
import type { MarkedNode } from './arrowKeys.model';
import { homeRows } from './home/state';
import { shortAddress, subscribeCachedRows } from '../modules/messaging';
import { useStoreValue } from '../lib/storeCore';
import { usePalette } from '../lib/theme';
import { useClearedChats } from '../lib/clearedChats';
import { useWebTabRail } from '../lib/webLayout';
import { getPeerDisplayName, getPeerHandle, getPeerName, usePeerProfiles } from '../lib/peerProfiles';
import {
  FILTER_FIELDS, filterMenuKey, filterMenuSize, isSearchFilterOn, memberNames, memberTokenValue, pickSearchFilter,
  searchFilterMenu, searchFilterSources, searchFilterValues, toggleSearchFilter,
  type FilterField, type FilterMenu, type FilterOption, type FilterOptions, type FilterScope, type FilterSpan,
} from './searchFilter.model';

const FILTER_PLACEHOLDER = 'Filter by keyword or by field';
const MENU_MAX_HEIGHT = 360;
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

function useFilterInput(query: string, setQuery: (query: string) => void, options: FilterOptions, enabled: boolean): FilterInput {
  const [focused, setFocused] = useState(false);
  const [caret, setCaret] = useState(query.length);
  const [selection, setSelection] = useState<FilterSpan | undefined>(undefined);
  const [dismissed, setDismissed] = useState(false);
  const [active, setActive] = useState({ key: '', index: 0 });
  const found = enabled && focused ? searchFilterMenu(query, Math.min(caret, query.length), options) : null;
  const menu = dismissed ? null : found;
  const menuKey = `${filterMenuKey(menu)}|${query}`;
  const index = active.key === menuKey ? Math.min(active.index, filterMenuSize(menu) - 1) : 0;
  const pick = (at: number): void => {
    const next = menu === null ? null : pickSearchFilter(query, menu, at);
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

function FilterOptionItem({ field, option, highlighted, selected, onPress }: {
  field: FilterField; option: FilterOption; highlighted?: boolean; selected?: boolean; onPress: () => void;
}): React.ReactElement {
  const member = field === 'member';
  return (
    <DropdownMenuItem
      label={option.label}
      iconName={member ? undefined : IconTag}
      icon={member ? <Avatar address={option.key} size={DROPDOWN_MENU.icon}/> : undefined}
      highlighted={highlighted}
      selected={selected}
      onPress={onPress}
    />
  );
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
  const { field } = menu;
  return <>{menu.options.map((option, i) => (
    <Box key={option.key} {...optionMark(i)}>
      <FilterOptionItem field={field} option={option} highlighted={i === active} onPress={() => { onPick(i); }}/>
    </Box>
  ))}</>;
}

function FilterChip({ field, active, onPress }: {
  field: FilterField; active: boolean; onPress: (event: GestureResponderEvent) => void;
}): React.ReactElement {
  const { text, bg } = usePalette();
  const color = active ? bg : text;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Filter by ${field}`}>
      <LabelChip
        label={FIELD_NAMES[field]} selected={active}
        leading={<Glyph icon={FIELD_ICONS[field]} size={LABEL_CHIP_ICON_SIZE} color={color}/>}
        trailing={<Glyph icon={IconChevronBottom} size={LABEL_CHIP_ICON_SIZE} color={color}/>}
      />
    </Pressable>
  );
}

function FilterChips({ options, query, setQuery }: {
  options: FilterOptions; query: string; setQuery: (query: string) => void;
}): React.ReactElement | null {
  const [open, setOpen] = useState<{ field: FilterField; anchor: MenuPoint } | null>(null);
  const fields = FILTER_FIELDS.filter(field => options[field].length > 0);
  if (fields.length === 0) return null;
  const close = (): void => { setOpen(null); };
  const toggle = (field: FilterField, value: string): void => {
    close();
    setQuery(toggleSearchFilter(query, field, value));
  };
  return (
    <>
      <Row gap={8} padding={{ x: PAGE_GUTTER, top: LIST_TOP_GAP }} surface="surface">
        {fields.map(field => (
          <FilterChip
            key={field} field={field} active={searchFilterValues(query, field).length > 0}
            onPress={(event) => { Keyboard.dismiss(); setOpen({ field, anchor: menuPointBelow(event) }); }}
          />
        ))}
      </Row>
      <AnchoredMenu visible={open !== null} onClose={close} anchor={open?.anchor}>
        {open === null ? null : options[open.field].map(option => (
          <FilterOptionItem
            key={option.key} field={open.field} option={option} selected={isSearchFilterOn(query, open.field, option.value)}
            onPress={() => { toggle(open.field, option.value); }}
          />
        ))}
      </AnchoredMenu>
    </>
  );
}

export function FilterSearch({ query, setQuery, scope, onMenu, ...bar }: {
  query: string;
  setQuery: (query: string) => void;
  scope: FilterScope;
  onMenu: (open: boolean) => void;
} & Omit<React.ComponentProps<typeof SearchTopnavBar>, 'query' | 'setQuery' | 'inputProps' | 'placeholder'>): React.ReactElement {
  const wide = useWebTabRail();
  const options = useFilterOptions(scope);
  const filter = useFilterInput(query, setQuery, options, wide);
  const open = filter.menu !== null;
  useEffect(() => { onMenu(open); }, [open]);
  useEffect(() => () => { onMenu(false); }, []);
  if (!wide) {
    return (
      <Box style={bar.inline === true ? undefined : STICKY_UNDER_CHROME}>
        <SearchTopnavBar {...bar} inline query={query} setQuery={setQuery}/>
        <FilterChips options={options} query={query} setQuery={setQuery}/>
      </Box>
    );
  }
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
