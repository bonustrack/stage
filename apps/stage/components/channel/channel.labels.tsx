import { useCallback, useMemo, useState } from 'react';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Text } from '@stage-labs/kit/react-native/text';
import { Glyph } from '@stage-labs/kit/react-native/glyph';
import { Col, Row, PAGE_GUTTER } from '../layout';
import { FormField } from '../FormField';
import { LabelChip, LABEL_CHIP_ICON_SIZE } from '../LabelChip';
import {
  PickerList, PickerNote, PickerRow, PickerSearch, SectionNote, SidebarSection, type SectionDraft,
} from '../conversation/SidebarSection';
import { includesKey, matchesQuery, selectedFirst, uniqueKeys, type ListEdits } from '../conversation/SidebarSection.model';
import { capabilities } from '../../lib/capabilities';
import { usePalette } from '../../lib/theme';
import {
  addGroupLabel, knownChannelFields, removeGroupLabel, setGroupCategory, setGroupField, suggestLabels,
} from '../../lib/xmtp.groups';
import {
  CHANNEL_PRIORITIES, channelFieldOf, cleanLabel, LabelPermissionError, MAX_LABEL_LEN, MAX_LABELS, type ChannelField,
} from '@stage-labs/client/xmtp/labels';
import { getCachedRows, subscribeCachedRows } from '../../lib/channelsCache';
import { lineOfConv } from '@stage-labs/client/xmtp/line';
import { useStoreValue } from '../../lib/storeCore';
import { useChannelEditRights } from './channel.detail';
import { IconCrossMedium } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconCrossMedium';
import { IconFolder1 } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconFolder1';
import { IconCircleDashed } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconCircleDashed';
import { IconFlag1 } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconFlag1';
import { IconPlusLarge } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconPlusLarge';
import { IconTag } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconTag';

const MAX_SUGGESTIONS = 8;

export function toastLabelError(e: unknown, what = 'labels'): void {
  if (e instanceof LabelPermissionError) capabilities.toast(e.message);
  else capabilities.toast(`Could not update ${what}. Try again.`);
}

export function setChannelCategory(convId: string, category: string | null): void {
  void setGroupCategory(lineOfConv(convId), category).catch((e: unknown) => { toastLabelError(e, 'the category'); });
}

const NO_LABELS: string[] = [];

function isLabelList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((label) => typeof label === 'string');
}

export function useLiveChannelLabels(convId: string | undefined): string[] {
  const read = useCallback((): string => {
    const labels = getCachedRows()?.find((row) => row.convId === convId)?.labels;
    return isLabelList(labels) ? labels.join('\n') : '';
  }, [convId]);
  const key = useStoreValue(subscribeCachedRows, read);
  return useMemo(() => (key === '' ? NO_LABELS : key.split('\n')), [key]);
}

function useLiveChannelField(convId: string | undefined, field: ChannelField): string | null {
  const read = useCallback(
    (): string | null => channelFieldOf(field, getCachedRows()?.find((row) => row.convId === convId)?.[field]),
    [convId, field],
  );
  return useStoreValue(subscribeCachedRows, read);
}

export async function writeLabels(line: string, edits: ListEdits): Promise<string[] | null> {
  let latest: string[] | null = null;
  for (const label of edits.removed) latest = await removeGroupLabel(line, label);
  for (const label of edits.added) latest = await addGroupLabel(line, label);
  return latest;
}

function SuggestionChip({ label, disabled, onAdd }: {
  label: string; disabled: boolean; onAdd: () => void;
}): React.ReactElement {
  const { text: fg } = usePalette();
  return (
    <Pressable
      onPress={onAdd}
      disabled={disabled}
      hitSlop={6}
      style={({ pressed }) => ({ opacity: disabled ? 0.5 : pressed ? 0.7 : 1 })}
    >
      <LabelChip label={label} leading={<Glyph icon={IconPlusLarge} size={LABEL_CHIP_ICON_SIZE} color={fg}/>} />
    </Pressable>
  );
}

function RemovableChips({ labels, disabled, onRemove }: {
  labels: string[]; disabled: boolean; onRemove: (label: string) => void;
}): React.ReactElement {
  const { text: fg } = usePalette();
  return (
    <Row gap={8} wrap align="center">
      {labels.map((label) => (
        <LabelChip
          key={label}
          label={label}
          trailing={(
            <Pressable
              hitSlop={8}
              disabled={disabled}
              accessibilityLabel={`Remove ${label}`}
              onPress={() => { onRemove(label); }}
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
            >
              <Glyph icon={IconCrossMedium} size={LABEL_CHIP_ICON_SIZE} color={fg} />
            </Pressable>
          )}
        />
      ))}
    </Row>
  );
}

function AddButton({ disabled, onAdd }: { disabled: boolean; onAdd: () => void }): React.ReactElement {
  const { text: fg, sub } = usePalette();
  return (
    <Pressable
      onPress={onAdd}
      disabled={disabled}
      hitSlop={8}
      accessibilityLabel="Add label"
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 4, opacity: disabled ? 0.5 : pressed ? 0.7 : 1 })}
    >
      <Glyph icon={IconPlusLarge} size={14} color={disabled ? sub : fg} />
      <Text size="2xs" color={disabled ? sub : fg}>Add</Text>
    </Pressable>
  );
}

export function ChannelLabelsEditor({ labels, input, setInput, disabled, onAdd, onRemove }: {
  labels: string[]; input: string; setInput: (s: string) => void; disabled: boolean;
  onAdd: (label: string) => void; onRemove: (label: string) => void;
}): React.ReactElement {
  const atCap = labels.length >= MAX_LABELS;
  const suggestions = useMemo(() => suggestLabels(input, labels).slice(0, MAX_SUGGESTIONS), [input, labels]);
  const submit = (): void => { onAdd(input); };
  return (
    <Col gap={10}>
      <FormField label="Labels" placeholder={atCap ? `Limit reached (${MAX_LABELS})` : 'Add a label'} value={input} onChangeText={setInput}
        onSubmit={submit} disabled={disabled || atCap} inputProps={{ maxLength: MAX_LABEL_LEN, returnKeyType: 'done' }}
        trailing={<AddButton disabled={disabled || atCap || !input.trim()} onAdd={submit} />} />
      {labels.length > 0 ? <RemovableChips labels={labels} disabled={disabled} onRemove={onRemove} /> : null}
      {!atCap && suggestions.length > 0 ? (
        <Row gap={8} wrap>
          {suggestions.map((label) => (
            <SuggestionChip key={label.toLowerCase()} label={label} disabled={disabled} onAdd={() => { onAdd(label); }} />
          ))}
        </Row>
      ) : null}
    </Col>
  );
}

function TagPicker({ draft, options, noun, pick }: {
  draft: string[]; options: string[]; noun: string; pick: (tag: string) => void;
}): React.ReactElement {
  const { text: fg, bg } = usePalette();
  const [query, setQuery] = useState('');
  const all = uniqueKeys([...options, ...draft]);
  const shown = all.filter(label => matchesQuery(query, label));
  const typed = cleanLabel(query);
  const creatable = typed !== '' && !includesKey(all, typed);
  const create = (): void => {
    if (!creatable) return;
    pick(typed);
    setQuery('');
  };
  return (
    <>
      <PickerSearch value={query} onChangeText={setQuery} placeholder="Search or create" onSubmit={create}/>
      <PickerList>
        {shown.map(label => (
          <PickerRow key={label.toLowerCase()} selected={includesKey(draft, label)} label={label} onPress={() => { pick(label); }}>
            <LabelChip label={label} background={bg}/>
          </PickerRow>
        ))}
        {creatable ? (
          <PickerRow selected={false} label={`Create ${noun} ${typed}`} onPress={create}>
            <Glyph icon={IconPlusLarge} size={LABEL_CHIP_ICON_SIZE} color={fg}/>
            <Text size="2xs" numberOfLines={1} style={{ flexShrink: 1 }}>{`Create "${typed}"`}</Text>
          </PickerRow>
        ) : null}
        {shown.length === 0 && !creatable ? <PickerNote text={`Type to create a ${noun}.`}/> : null}
      </PickerList>
    </>
  );
}

function LabelPicker({ draft, toggle, current }: SectionDraft & { current: string[] }): React.ReactElement {
  const [options] = useState(() => selectedFirst(uniqueKeys([...current, ...suggestLabels('', current)]), current));
  const pick = (label: string): void => {
    if (!includesKey(draft, label) && draft.length >= MAX_LABELS) { capabilities.toast(`A channel can have up to ${MAX_LABELS} labels.`); return; }
    toggle(label);
  };
  return <TagPicker draft={draft} options={options} noun="label" pick={pick}/>;
}

function FieldPicker({ draft, toggle, current, field }: SectionDraft & { current: string[]; field: ChannelField }): React.ReactElement {
  const [options] = useState(() => selectedFirst(uniqueKeys([...current, ...knownChannelFields(field)]), current));
  if (field === 'priority') return (
    <PickerList>
      {CHANNEL_PRIORITIES.map(priority => (
        <PickerRow key={priority} selected={includesKey(draft, priority)} label={priority} onPress={() => { toggle(priority); }}>
          <Text size="2xs">{priority}</Text>
        </PickerRow>
      ))}
    </PickerList>
  );
  return <TagPicker draft={draft} options={options} noun={field} pick={toggle}/>;
}

export function ChannelLabels({ convId, labels }: {
  convId: string; labels: string[];
}): React.ReactElement | null {
  const rights = useChannelEditRights(convId);
  if (labels.length === 0 && !rights.appData) return null;
  const commit = (edits: ListEdits): void => {
    void writeLabels(lineOfConv(convId), edits).catch(toastLabelError);
  };
  return (
    <SidebarSection title="Labels" icon={IconTag} count={labels.length} editLabel="Edit labels" canEdit={rights.appData} current={labels}
      onCommit={commit} renderPicker={(draft) => <LabelPicker {...draft} current={labels}/>}>
      {labels.length === 0 ? <SectionNote text="No labels yet"/> : (
        <Row gap={8} wrap align="center" padding={{ x: PAGE_GUTTER, bottom: 8 }}>
          {labels.map((label) => <LabelChip key={label} label={label}/>)}
        </Row>
      )}
    </SidebarSection>
  );
}

const CHANNEL_FIELDS = {
  category: { title: 'Category', icon: IconFolder1 },
  status: { title: 'Status', icon: IconCircleDashed },
  priority: { title: 'Priority', icon: IconFlag1 },
};

function ChannelFieldSection({ convId, field }: { convId: string; field: ChannelField }): React.ReactElement | null {
  const rights = useChannelEditRights(convId);
  const value = useLiveChannelField(convId, field);
  if (value === null && !rights.appData) return null;
  const current = value === null ? [] : [value];
  const commit = (edits: ListEdits): void => {
    void setGroupField(lineOfConv(convId), field, edits.added[0] ?? null).catch((e: unknown) => { toastLabelError(e, `the ${field}`); });
  };
  return (
    <SidebarSection {...CHANNEL_FIELDS[field]} editLabel={`Edit ${field}`} canEdit={rights.appData} current={current} single
      onCommit={commit} renderPicker={(draft) => <FieldPicker {...draft} current={current} field={field}/>}>
      {value === null ? <SectionNote text={`No ${field} yet`}/> : (
        <Row padding={{ x: PAGE_GUTTER, bottom: 8 }}><Text size="md" truncate style={{ flexShrink: 1 }}>{value}</Text></Row>
      )}
    </SidebarSection>
  );
}

export function ChannelFields({ convId }: { convId: string }): React.ReactElement {
  return <><ChannelFieldSection convId={convId} field="category"/><ChannelFieldSection convId={convId} field="status"/><ChannelFieldSection convId={convId} field="priority"/></>;
}
