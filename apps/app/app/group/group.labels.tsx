
import { useEffect, useMemo, useState } from 'react';
import { fontSize } from '@stage-labs/kit/tokens';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Input } from '@stage-labs/kit/react-native/input';
import { Text } from '@stage-labs/kit/react-native/text';
import { Icon } from '@stage-labs/kit/react-native/icon';
import { KitRenderer } from '@stage-labs/kit/react-native/kit-renderer';
import type { WidgetActionRegistry, WidgetRoot } from '@stage-labs/kit/kit';
import { labelRow, LABEL_REMOVE } from '@stage-labs/views';
import { Box, Row } from '../../components/layout';
import { Spinner } from '../../components/Spinner';
import { flash } from '../../lib/toast';
import {
  getGroupLabels, addGroupLabel, removeGroupLabel,
  LabelPermissionError, MAX_LABEL_LEN, MAX_LABELS,
} from '../../modules/messaging';
import { suggestLabels } from '../../modules/messaging';

const MAX_SUGGESTIONS = 8;

function SuggestionChip({ label, busy, onAdd, p }: {
  label: string; busy: boolean; onAdd: () => void; p: Pal;
}): React.ReactElement {
  return (
    <Pressable
      onPress={onAdd}
      disabled={busy}
      hitSlop={6}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
        backgroundColor: p.rowBg,
        opacity: busy ? 0.5 : pressed ? 0.7 : 1,
      })}
>
      <Icon name="plus" size={12} color={p.sub}/>
      <Text size="xs" color={p.fg}>{label}</Text>
    </Pressable>
  );
}

interface Pal { fg: string; head: string; sub: string; border: string; rowBg: string; inputBg: string; }

function LabelChips({ labels, onRemove, p }: {
  labels: string[]; onRemove: (label: string) => void; p: Pal;
}): React.ReactElement {
  const node: WidgetRoot = {
    type: 'Basic',
    children: [
      labelRow({
        labels: labels.map((label) => ({ label, removable: true })),
        background: p.rowBg,
      }),
    ],
  };
  const registry: WidgetActionRegistry = {
    [LABEL_REMOVE]: (action) => {
      const label = action.payload.label;
      if (typeof label === 'string') onRemove(label);
    },
  };
  return <KitRenderer node={node} registry={registry} />;
}

function LabelAddRow({ draft, setDraft, busy, onAdd, p }: {
  draft: string; setDraft: (s: string) => void; busy: boolean; onAdd: () => void; p: Pal;
}): React.ReactElement {
  const { fg, sub, border, inputBg } = p;
  const disabled = busy || !draft.trim();
  return (
    <Row margin={{ top: 10 }} align="center" gap={8}>
      <Input
        value={draft}
        onChangeText={setDraft}
        onSubmit={onAdd}
        placeholder="Add a label"
        placeholderTextColor={sub}
        disabled={busy}
        inputProps={{ maxLength: MAX_LABEL_LEN, returnKeyType: 'done' }}
        style={{
          flex: 1, color: fg, backgroundColor: inputBg,
          borderWidth: 1, borderColor: border, borderRadius: 10,
          paddingHorizontal: 10, paddingVertical: 8, fontSize: fontSize('md'),
        }}
/>
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

export function GroupLabelsSection({ line, p }: { line: string; p: Pal }): React.ReactElement {
  const { sub } = p;
  const [labels, setLabels] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getGroupLabels(line).then((ls) => { if (!cancelled) setLabels(ls); }).catch(() => undefined);
    return (): void => { cancelled = true; };
  }, [line]);

  const reportError = (e: unknown): void => {
    if (e instanceof LabelPermissionError) flash(e.message);
    else flash('Could not update labels. Try again.');
  };

  const add = async (value: string): Promise<void> => {
    const clean = value.trim();
    if (!clean || busy) return;
    setBusy(true);
    try {
      const next = await addGroupLabel(line, clean);
      setLabels(next);
      setDraft('');
    } catch (e) { reportError(e); } finally { setBusy(false); }
  };

  const remove = async (label: string): Promise<void> => {
    if (removing) return;
    setRemoving(label);
    try {
      const next = await removeGroupLabel(line, label);
      setLabels(next);
    } catch (e) { reportError(e); } finally { setRemoving(null); }
  };

  const atCap = labels.length >= MAX_LABELS;

  const suggestions = useMemo(
    () => suggestLabels(draft, labels).slice(0, MAX_SUGGESTIONS),
    [draft, labels],
  );

  return (
    <Box padding={{ x: 16, bottom: 16 }}>
      <Row align="center" gap={6}>
        <Icon name="tag" size={13} color={sub}/>
        <Text size="xs" role="secondary">LABELS</Text>
      </Row>

      {labels.length> 0 ? (
        <Box margin={{ top: 10 }}>
          <LabelChips labels={labels} onRemove={(label) => { void remove(label); }} p={p} />
        </Box>
      ) : null}

      {!atCap ? (
        <LabelAddRow draft={draft} setDraft={setDraft} busy={busy} onAdd={() => { void add(draft); }} p={p}/>
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
              p={p}
/>
          ))}
        </Row>
      ) : null}
    </Box>
  );
}
