
import { useEffect, useMemo, useState } from 'react';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Text } from '@stage-labs/kit/react-native/text';
import { Icon } from '@stage-labs/kit/react-native/icon';
import { useKitScheme } from '@stage-labs/kit/react-native/theme-context';
import { Box, Row, PAGE_GUTTER } from '../layout';
import { FormField } from '../FormField';
import { LabelText } from '../LabelText';
import { Spinner } from '../Spinner';
import { capabilities } from '../../lib/capabilities';
import { usePalette } from '../../lib/theme';
import {
  getGroupLabels, addGroupLabel, removeGroupLabel,
  LabelPermissionError, MAX_LABEL_LEN, MAX_LABELS,
} from '../../modules/messaging';
import { suggestLabels } from '../../modules/messaging';
import { reported } from '../../lib/errorPolicy';

const MAX_SUGGESTIONS = 8;

export function toastLabelError(e: unknown): void {
  if (e instanceof LabelPermissionError) capabilities.toast(e.message);
  else capabilities.toast('Could not update labels. Try again.');
}

function SuggestionChip({ label, busy, onAdd }: {
  label: string; busy: boolean; onAdd: () => void;
}): React.ReactElement {
  const { text: fg, border } = usePalette();
  return (
    <Pressable
      onPress={onAdd}
      disabled={busy}
      hitSlop={6}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
        backgroundColor: border,
        opacity: busy ? 0.5 : pressed ? 0.7 : 1,
      })}
>
      <Icon name="plus" size={12} color={fg}/>
      <LabelText label={label} size="xs" color={fg} />
    </Pressable>
  );
}

function LabelChips({ labels, onRemove }: {
  labels: string[]; onRemove: (label: string) => void;
}): React.ReactElement {
  const dark = useKitScheme() === 'dark';
  const { text: fg, border } = usePalette();
  return (
    <Row gap={8} wrap align="center">
      {labels.map((label) => (
        <Row
          key={label}
          align="center"
          gap={6}
          radius="full"
          background={border}
          padding={{ y: 6, left: 12, right: 10 }}
        >
          <LabelText label={label} size="xs" color={fg} />
          <Pressable
            hitSlop={8}
            onPress={() => { onRemove(label); }}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          >
            <Icon name="x" size={14} color={fg} dark={dark} />
          </Pressable>
        </Row>
      ))}
    </Row>
  );
}

function LabelAddRow({ draft, setDraft, busy, onAdd }: {
  draft: string; setDraft: (s: string) => void; busy: boolean; onAdd: () => void;
}): React.ReactElement {
  const { text: fg, border } = usePalette();
  const disabled = busy || !draft.trim();
  return (
    <Row margin={{ top: 10 }} align="center" gap={8}>
      <Box flex={1}>
        <FormField label="Label" placeholder="Add a label" value={draft} onChangeText={setDraft} onSubmit={onAdd} disabled={busy}
          inputProps={{ maxLength: MAX_LABEL_LEN, returnKeyType: 'done' }} />
      </Box>
      <Pressable
        onPress={onAdd}
        disabled={disabled}
        hitSlop={8}
        style={({ pressed }) => ({
          flexDirection: 'row', alignItems: 'center', gap: 4,
          paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
          borderWidth: 1, borderColor: border,
          opacity: disabled ? 0.5 : 1,
          backgroundColor: pressed ? border : 'transparent',
        })}
>
        {busy ? <Spinner size={14} color={fg} /> : <Icon name="plus" size={14} color={fg} />}
        <Text size="xs" color={fg}>Add</Text>
      </Pressable>
    </Row>
  );
}

export function GroupLabelsSection({ line }: { line: string }): React.ReactElement {
  const { text: sub } = usePalette();
  const [labels, setLabels] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getGroupLabels(line).then((ls) => { if (!cancelled) setLabels(ls); }).catch(reported('group.labels'));
    return (): void => { cancelled = true; };
  }, [line]);

  const add = async (value: string): Promise<void> => {
    const clean = value.trim();
    if (!clean || busy) return;
    setBusy(true);
    try {
      const next = await addGroupLabel(line, clean);
      setLabels(next);
      setDraft('');
    } catch (e) { toastLabelError(e); } finally { setBusy(false); }
  };

  const remove = async (label: string): Promise<void> => {
    if (removing) return;
    setRemoving(label);
    try {
      const next = await removeGroupLabel(line, label);
      setLabels(next);
    } catch (e) { toastLabelError(e); } finally { setRemoving(null); }
  };

  const atCap = labels.length >= MAX_LABELS;

  const suggestions = useMemo(
    () => suggestLabels(draft, labels).slice(0, MAX_SUGGESTIONS),
    [draft, labels],
  );

  return (
    <Box padding={{ x: PAGE_GUTTER, bottom: 16 }}>
      <Row align="center" gap={6}>
        <Icon name="tag" size={13} color={sub}/>
        <Text size="xs" role="secondary">LABELS</Text>
      </Row>

      {labels.length> 0 ? (
        <Box margin={{ top: 10 }}>
          <LabelChips labels={labels} onRemove={(label) => { void remove(label); }} />
        </Box>
      ) : null}

      {!atCap ? (
        <LabelAddRow draft={draft} setDraft={setDraft} busy={busy} onAdd={() => { void add(draft); }}/>
      ) : (
        <Text size="xs" role="secondary" style={{ marginTop: 8 }}>
          Label limit reached ({MAX_LABELS}).
        </Text>
      )}

      {!atCap && suggestions.length> 0 ? (
        <Row margin={{ top: 10 }} gap={8} style={{ flexWrap: 'wrap' }}>
          {suggestions.map((label) => (
            <SuggestionChip
              key={label.toLowerCase()}
              label={label}
              busy={busy}
              onAdd={() => { void add(label); }}
/>
          ))}
        </Row>
      ) : null}
    </Box>
  );
}
