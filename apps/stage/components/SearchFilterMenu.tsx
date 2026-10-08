import { useState } from 'react';
import { IconCircleMinus } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconCircleMinus';
import { IconCrossMedium } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconCrossMedium';
import { DROPDOWN_MENU, DropdownMenuSeparator } from '@stage-labs/kit/react-native/menu';
import { AppIcon } from './widgets';
import type { AppIconName } from './appIcons';
import { Avatar } from './Avatar';
import { AccountAvatar } from './AccountAvatarButton';
import { MenuHeading, MenuRow } from './MenuRows';
import { PickerNote, PickerRow, PickerSearch } from './conversation/SidebarSection';
import { peerLabel } from './conversation/convTitle';
import { usePeerProfiles } from '../lib/peerProfiles';
import { memberNamesOf, useSearchFilterSources } from './FilterSearch';
import {
  FILTER_FIELDS, HAS_OPTIONS, PRIORITY_OPTIONS, ME_OPTION, ME_VALUE, clearQueryFilters, memberFilterOption,
  searchFilterOptionMatches as matches, searchFilterCount, searchFilterValues, selectedSearchFilters, toggleSearchFilter,
  type FilterField, type FilterOption, type FilterOptions, type FilterScope,
} from './searchFilter.model';

const FIELD_NAMES: Record<FilterField, string> = {
  member: 'Member', category: 'Category', status: 'Status', priority: 'Priority', label: 'Label', has: 'Has',
};
const FIELD_ICONS: Record<FilterField, AppIconName> = {
  member: 'IconPeople', category: 'IconFolder1', status: 'IconCircleDashed', priority: 'IconFlag1', label: 'IconTag', has: 'IconFilter1',
};
const valueOption = (value: string): FilterOption => ({ key: value, label: value, value });

function useFilterOptions(scope: FilterScope): FilterOptions {
  const sources = useSearchFilterSources(scope);
  usePeerProfiles(sources.members);
  return {
    has: HAS_OPTIONS,
    label: sources.labels.map(valueOption),
    category: sources.categories.map(valueOption),
    status: sources.statuses.map(valueOption),
    priority: PRIORITY_OPTIONS,
    member: [ME_OPTION, ...sources.members.map(address => (
      memberFilterOption(address, peerLabel(address), memberNamesOf(address))
    )).sort((a, b) => a.label.localeCompare(b.label))],
  };
}

function OptionIcon({ field, option }: { field: FilterField; option: FilterOption }): React.ReactElement {
  if (field === 'member' && option.key === ME_VALUE) return <AccountAvatar size={DROPDOWN_MENU.icon}/>;
  if (field === 'member' && option.key.startsWith('0x')) return <Avatar address={option.key} size={DROPDOWN_MENU.icon}/>;
  return <AppIcon name={field === 'has' && option.value === 'draft' ? 'IconPencil' : FIELD_ICONS[field]} size={DROPDOWN_MENU.icon} color="link"/>;
}

function FilterValues({ field, options, query, setQuery, onBack }: {
  field: FilterField; options: readonly FilterOption[]; query: string; setQuery: (query: string) => void; onBack: () => void;
}): React.ReactElement {
  const [needle, setNeedle] = useState('');
  const [excluded, setExcluded] = useState(false);
  const selected = selectedSearchFilters(query, field, excluded);
  const excludedCount = selectedSearchFilters(query, field, true).length;
  const saved = searchFilterValues(query, field).filter(value => !options.some(option => matches(field, option,value))).map(valueOption);
  const available = [...options, ...saved];
  const matching = available.filter(option => [option.label, option.value].some(value => value.toLowerCase().includes(needle.toLowerCase())));
  const custom = needle.trim();
  if (custom !== '' && field !== 'has' && field !== 'priority' && !available.some(option => matches(field, option,custom))) matching.push(valueOption(custom));
  const pick = (option: FilterOption): void => { setQuery(toggleSearchFilter(query, field, option.value, excluded, option.aliases)); };
  return <>
    <MenuRow icon="IconArrowLeft" label="Filter" onPress={onBack}/>
    <DropdownMenuSeparator/>
    <MenuHeading text={FIELD_NAMES[field]}/>
    <PickerSearch value={needle} onChangeText={setNeedle} placeholder={`Search ${FIELD_NAMES[field].toLowerCase()}`} />
    {field === 'has' ? null : <PickerRow label={`Exclude ${FIELD_NAMES[field].toLowerCase()}`} selected={excluded} count={excludedCount > 0 ? excludedCount : undefined}
      leading={<AppIcon name={IconCircleMinus} size={DROPDOWN_MENU.icon} color="link"/>} onPress={() => { setExcluded(!excluded); }}/>}
    {matching.map(option => <PickerRow key={option.key} label={option.label} selected={selected.some(value => matches(field, option, value))}
      leading={<OptionIcon field={field} option={option}/>} onPress={() => { pick(option); }}/>) }
    {matching.length === 0 ? <PickerNote text="No options"/> : null}
    {searchFilterValues(query, field).length === 0 ? null : <MenuRow divider icon={IconCrossMedium} label={`Clear ${FIELD_NAMES[field].toLowerCase()}`}
      onPress={() => { setQuery(clearQueryFilters(query, field)); }}/>}
  </>;
}

export function SearchFilterMenu({ query, setQuery, scope, onBack }: {
  query: string; setQuery: (query: string) => void; scope: FilterScope; onBack: () => void;
}): React.ReactElement {
  const options = useFilterOptions(scope);
  const [field, setField] = useState<FilterField | null>(null);
  if (field !== null) return <FilterValues key={field} field={field} options={options[field]} query={query} setQuery={setQuery} onBack={() => { setField(null); }}/>;
  return <>
    <MenuRow icon="IconArrowLeft" label="View" onPress={onBack}/>
    <DropdownMenuSeparator/>
    <MenuHeading text="Filter"/>
    {FILTER_FIELDS.map(key => {
      const count = searchFilterValues(query, key).length;
      return <MenuRow key={key} icon={FIELD_ICONS[key]} label={FIELD_NAMES[key]} count={count > 0 ? count : undefined}
        onPress={() => { setField(key); }}/>;
    })}
    {searchFilterCount(query) === 0 ? null : <MenuRow divider icon={IconCrossMedium} label="Clear filters" onPress={() => { setQuery(clearQueryFilters(query)); }}/>}
  </>;
}
