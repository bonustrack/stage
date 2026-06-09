/** Group LABELS section — chips for the group's synced `appData` labels.
 *  Renders only for groups (the parent gates on the group line). Any member may
 *  add a label via the inline input or remove one by tapping its chip's x.
 *  Backed by lib/xmtp.labels (read → mutate → write to MLS-synced appData). */

import { useEffect, useMemo, useState } from 'react';
import { fontSize } from '@metro-labs/kit/tokens';
import { Pressable } from '@metro-labs/kit/pressable';
import { Input } from '@metro-labs/kit/input';
import { Text } from '@metro-labs/kit/text';
import { Icon } from '@metro-labs/kit/icon';
import { Box } from '../../components/layout';
import { Spinner } from '../../components/Spinner';
import { flash } from '../../lib/toast';
import {
  getGroupLabels, addGroupLabel, removeGroupLabel,
  LabelPermissionError, MAX_LABEL_LEN, MAX_LABELS,
} from '../../modules/messaging';
import { suggestLabels } from '../../modules/messaging';

/** How many suggestion chips to show at once (keeps the row compact). */
const MAX_SUGGESTIONS = 8;

/** One tappable suggestion pill — filled, borderless (matches the label chip
 *  fill), with a leading + to read as "add this". */
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
      <Icon name="plus" size={12} color={p.sub} />
      <Text size="sm" style={{ color: p.fg, fontFamily: 'Calibre-Medium' }}>{label}</Text>
    </Pressable>
  );
}

interface Pal { fg: string; head: string; sub: string; border: string; rowBg: string; inputBg: string; }

/** One label pill: text + a tappable x to remove. */
function LabelChip({ label, busy, onRemove, p }: {
  label: string; busy: boolean; onRemove: () => void; p: Pal;
}): React.ReactElement {
  return (
    <Box style={{
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingLeft: 12, paddingRight: 8, paddingVertical: 6, borderRadius: 999,
      backgroundColor: p.rowBg,
      opacity: busy ? 0.5 : 1,
    }}>
      <Text size="sm" style={{ color: p.fg, fontFamily: 'Calibre-Medium' }}>{label}</Text>
      <Pressable onPress={onRemove} disabled={busy} hitSlop={8} style={{ padding: 2 }}>
        <Icon name="x" size={14} color={p.sub} />
      </Pressable>
    </Box>
  );
}

export function GroupLabelsSection({ line, p }: { line: string; p: Pal }): React.ReactElement {
  const { fg, sub, border, inputBg } = p;
  const [labels, setLabels] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  /** Label currently being removed (for the per-chip spinner/opacity). */
  const [removing, setRemoving] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getGroupLabels(line).then((ls) => { if (!cancelled) setLabels(ls); }).catch(() => undefined);
    return (): void => { cancelled = true; };
  }, [line]);

  /** Map a thrown error to a user-facing message; permission denial is inline. */
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

  /** Distinct labels from the user's OTHER groups (in-memory channels cache),
   *  filtered by the current draft + excluding ones already on this group.
   *  Recomputed only when the draft or this group's labels change. */
  const suggestions = useMemo(
    () => suggestLabels(draft, labels).slice(0, MAX_SUGGESTIONS),
    [draft, labels],
  );

  return (
    <Box style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
      <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Icon name="tag" size={13} color={sub} />
        <Text size="sm" style={{ color: sub, fontFamily: 'Calibre-Medium' }}>LABELS</Text>
      </Box>

      {labels.length > 0 ? (
        <Box style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
          {labels.map((label) => (
            <LabelChip
              key={label.toLowerCase()}
              label={label}
              busy={removing === label}
              onRemove={() => { void remove(label); }}
              p={p}
            />
          ))}
        </Box>
      ) : null}

      {!atCap ? (
        <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}>
          <Input
            value={draft}
            onChangeText={setDraft}
            onSubmit={() => { void add(draft); }}
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
            onPress={() => { void add(draft); }}
            disabled={busy || !draft.trim()}
            hitSlop={8}
            style={({ pressed }) => ({
              flexDirection: 'row', alignItems: 'center', gap: 4,
              paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
              borderWidth: 1, borderColor: border,
              opacity: busy || !draft.trim() ? 0.5 : 1,
              backgroundColor: pressed ? border : 'transparent',
            })}
          >
            {busy ? <Spinner size={14} color={fg} /> : <Icon name="plus" size={14} color={fg} />}
            <Text size="sm" style={{ color: fg, fontFamily: 'Calibre-Medium' }}>Add</Text>
          </Pressable>
        </Box>
      ) : (
        <Text size="sm" style={{ color: sub, marginTop: 8, fontFamily: 'Calibre-Medium' }}>
          Label limit reached ({MAX_LABELS}).
        </Text>
      )}

      {!atCap && suggestions.length > 0 ? (
        <Box style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
          {suggestions.map((label) => (
            <SuggestionChip
              key={label.toLowerCase()}
              label={label}
              busy={busy}
              onAdd={() => { void add(label); }}
              p={p}
            />
          ))}
        </Box>
      ) : null}
    </Box>
  );
}
