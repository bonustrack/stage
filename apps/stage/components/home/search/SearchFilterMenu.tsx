import { useState } from 'react';
import type { HomeView } from '../../../lib/homeView';
import { IconCircleMinus } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconCircleMinus';
import { IconCrossMedium } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconCrossMedium';
import { DROPDOWN_MENU, DropdownMenuSeparator } from '@stage-labs/kit/react-native/menu';
import { AppIcon } from '../../widgets';
import type { AppIconName } from '../../appIcons';
import { Avatar } from '../../Avatar';
import { AccountAvatar } from '../../AccountAvatarButton';
import { MenuHeading, MenuRow } from '../../MenuRows';
import { PickerNote, PickerRow, PickerSearch } from '../../PickerRows';
import { peerLabel, usePeerProfiles } from '../../../lib/peerProfiles';
import { GROUPING_FIELDS } from '../../../lib/grouping.model';
import { memberNamesOf, useKnownFieldValues } from '../listing';
import {
  FILTER_FIELDS,
  HAS_OPTIONS,
  PRIORITY_OPTIONS,
  ME_OPTION,
  ME_VALUE,
  clearQueryFilters,
  memberFilterOption,
  searchFilterOptionMatches as matches,
  searchFilterCount,
  searchFilterValues,
  selectedSearchFilters,
  toggleSearchFilter,
  type FilterField,
  type FilterOption,
  type FilterOptions,
} from './searchFilter.model';

const { category, status, priority, label } = GROUPING_FIELDS;
const FIELDS: Record<FilterField, { label: string; icon: AppIconName }> = {
  member: { label: 'Member', icon: 'IconPeople' },
  category,
  status,
  priority,
  label,
  has: { label: 'Has', icon: 'IconFilter1' },
};
const valueOption = (value: string): FilterOption => ({ key: value, label: value, value });

function useFilterOptions(scope: HomeView): FilterOptions {
  const sources = useKnownFieldValues(scope);
  usePeerProfiles(sources.members);
  return {
    has: HAS_OPTIONS,
    label: sources.labels.map(valueOption),
    category: sources.categories.map(valueOption),
    status: sources.statuses.map(valueOption),
    priority: PRIORITY_OPTIONS,
    member: [
      ME_OPTION,
      ...sources.members
        .map((address) => memberFilterOption(address, peerLabel(address), memberNamesOf(address)))
        .sort((a, b) => a.label.localeCompare(b.label)),
    ],
  };
}

function OptionIcon({ field, option }: { field: FilterField; option: FilterOption }): React.ReactElement {
  if (field === 'member' && option.key === ME_VALUE) return <AccountAvatar size={DROPDOWN_MENU.icon} />;
  if (field === 'member' && option.key.startsWith('0x')) return <Avatar address={option.key} size={DROPDOWN_MENU.icon} />;
  return (
    <AppIcon
      name={field === 'has' && option.value === 'draft' ? 'IconPencil' : FIELDS[field].icon}
      size={DROPDOWN_MENU.icon}
      color="link"
    />
  );
}

function FilterValues({
  field,
  options,
  query,
  setQuery,
  onBack,
}: {
  field: FilterField;
  options: readonly FilterOption[];
  query: string;
  setQuery: (query: string) => void;
  onBack: () => void;
}): React.ReactElement {
  const [needle, setNeedle] = useState('');
  const [excluded, setExcluded] = useState(false);
  const selected = selectedSearchFilters(query, field, excluded);
  const excludedCount = selectedSearchFilters(query, field, true).length;
  const saved = searchFilterValues(query, field)
    .filter((value) => !options.some((option) => matches(field, option, value)))
    .map(valueOption);
  const available = [...options, ...saved];
  const matching = available.filter((option) =>
    [option.label, option.value].some((value) => value.toLowerCase().includes(needle.toLowerCase())),
  );
  const custom = needle.trim();
  if (custom !== '' && field !== 'has' && field !== 'priority' && !available.some((option) => matches(field, option, custom)))
    matching.push(valueOption(custom));
  const pick = (option: FilterOption): void => {
    setQuery(toggleSearchFilter(query, field, option.value, excluded, option.aliases));
  };
  return (
    <>
      <MenuRow icon="IconArrowLeft" label="Filter" onPress={onBack} />
      <DropdownMenuSeparator />
      <MenuHeading text={FIELDS[field].label} />
      <PickerSearch value={needle} onChangeText={setNeedle} placeholder={`Search ${FIELDS[field].label.toLowerCase()}`} />
      {field === 'has' ? null : (
        <PickerRow
          label={`Exclude ${FIELDS[field].label.toLowerCase()}`}
          selected={excluded}
          count={excludedCount > 0 ? excludedCount : undefined}
          leading={<AppIcon name={IconCircleMinus} size={DROPDOWN_MENU.icon} color="link" />}
          onPress={() => {
            setExcluded(!excluded);
          }}
        />
      )}
      {matching.map((option) => (
        <PickerRow
          key={option.key}
          label={option.label}
          selected={selected.some((value) => matches(field, option, value))}
          leading={<OptionIcon field={field} option={option} />}
          onPress={() => {
            pick(option);
          }}
        />
      ))}
      {matching.length === 0 ? <PickerNote text="No options" /> : null}
      {searchFilterValues(query, field).length === 0 ? null : (
        <MenuRow
          divider
          icon={IconCrossMedium}
          label={`Clear ${FIELDS[field].label.toLowerCase()}`}
          onPress={() => {
            setQuery(clearQueryFilters(query, field));
          }}
        />
      )}
    </>
  );
}

export function SearchFilterMenu({
  query,
  setQuery,
  scope,
  onBack,
  children,
}: {
  query: string;
  setQuery: (query: string) => void;
  scope: HomeView;
  onBack: () => void;
  children?: React.ReactNode;
}): React.ReactElement {
  const options = useFilterOptions(scope);
  const [field, setField] = useState<FilterField | null>(null);
  if (field !== null)
    return (
      <FilterValues
        key={field}
        field={field}
        options={options[field]}
        query={query}
        setQuery={setQuery}
        onBack={() => {
          setField(null);
        }}
      />
    );
  return (
    <>
      <MenuRow icon="IconArrowLeft" label="View" onPress={onBack} />
      <DropdownMenuSeparator />
      <MenuHeading text="Filter" />
      {children}
      {FILTER_FIELDS.map((key) => {
        const count = searchFilterValues(query, key).length;
        return (
          <MenuRow
            key={key}
            icon={FIELDS[key].icon}
            label={FIELDS[key].label}
            count={count > 0 ? count : undefined}
            onPress={() => {
              setField(key);
            }}
          />
        );
      })}
      {searchFilterCount(query) === 0 ? null : (
        <MenuRow
          divider
          icon={IconCrossMedium}
          label="Clear filters"
          onPress={() => {
            setQuery(clearQueryFilters(query));
          }}
        />
      )}
    </>
  );
}
