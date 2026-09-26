import { useEffect, useMemo, useState } from 'react';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Text } from '@stage-labs/kit/react-native/text';
import { Glyph } from '@stage-labs/kit/react-native/glyph';
import { Box, Col, Row, PAGE_GUTTER } from '../layout';
import { FormField } from '../FormField';
import { LabelChip, LABEL_CHIP_ICON_SIZE } from '../LabelChip';
import { capabilities } from '../../lib/capabilities';
import { usePalette } from '../../lib/theme';
import { getGroupLabels, LabelPermissionError, MAX_LABEL_LEN, MAX_LABELS } from '../../modules/messaging';
import { suggestLabels } from '../../modules/messaging';
import { reported } from '../../lib/errorPolicy';
import { IconCrossMedium } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconCrossMedium';
import { IconPlusLarge } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconPlusLarge';
import { IconTag } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconTag';

const MAX_SUGGESTIONS = 8;

export function toastLabelError(e: unknown): void {
  if (e instanceof LabelPermissionError) capabilities.toast(e.message);
  else capabilities.toast('Could not update labels. Try again.');
}

export function useGroupLabels(line: string): [string[], (labels: string[]) => void] {
  const [labels, setLabels] = useState<string[]>([]);
  useEffect(() => {
    let cancelled = false;
    void getGroupLabels(line).then((ls) => { if (!cancelled) setLabels(ls); }).catch(reported('group.labels'));
    return (): void => { cancelled = true; };
  }, [line]);
  return [labels, setLabels];
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
      <Text size="md" color={disabled ? sub : fg}>Add</Text>
    </Pressable>
  );
}

export function GroupLabelsEditor({ labels, input, setInput, disabled, onAdd, onRemove }: {
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

export function GroupLabelsView({ labels }: { labels: string[] }): React.ReactElement | null {
  const { text: sub } = usePalette();
  if (labels.length === 0) return null;
  return (
    <Box padding={{ x: PAGE_GUTTER, bottom: 16 }}>
      <Row align="center" gap={6}>
        <Glyph icon={IconTag} size={13} color={sub}/>
        <Text size="xs" role="secondary">LABELS</Text>
      </Row>
      <Row margin={{ top: 10 }} gap={8} wrap align="center">
        {labels.map((label) => <LabelChip key={label} label={label} />)}
      </Row>
    </Box>
  );
}
