/** Group LABELS section — chips for the group's synced `appData` labels.
 *  Renders only for groups (the parent gates on the group line). Any member may
 *  add a label via the inline input or remove one by tapping its chip's x.
 *  Backed by lib/xmtp.labels (read → mutate → write to MLS-synced appData). */

import { useEffect, useState } from 'react';
import { Pressable, TextInput } from 'react-native';
import { Text } from '@metro-labs/kit/text';
import { Icon } from '@metro-labs/kit/icon';
import { Box } from '../../components/layout';
import { Spinner } from '../../components/Spinner';
import { flash } from '../../lib/toast';
import {
  getGroupLabels, addGroupLabel, removeGroupLabel,
  LabelPermissionError, MAX_LABEL_LEN, MAX_LABELS,
} from '../../lib/xmtp.labels';

interface Pal { fg: string; head: string; sub: string; border: string; rowBg: string; }

/** One label pill: text + a tappable x to remove. */
function LabelChip({ label, busy, onRemove, p }: {
  label: string; busy: boolean; onRemove: () => void; p: Pal;
}): React.ReactElement {
  return (
    <Box style={{
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingLeft: 12, paddingRight: 8, paddingVertical: 6, borderRadius: 999,
      borderWidth: 1, borderColor: p.border, backgroundColor: p.rowBg,
      opacity: busy ? 0.5 : 1,
    }}>
      <Text style={{ color: p.fg, fontSize: 13, fontFamily: 'Calibre-Medium' }}>{label}</Text>
      <Pressable onPress={onRemove} disabled={busy} hitSlop={8} style={{ padding: 2 }}>
        <Icon name="x" size={14} color={p.sub} />
      </Pressable>
    </Box>
  );
}

export function GroupLabelsSection({ line, p }: { line: string; p: Pal }): React.ReactElement {
  const { fg, sub, border, rowBg } = p;
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

  const add = async (): Promise<void> => {
    const value = draft.trim();
    if (!value || busy) return;
    setBusy(true);
    try {
      const next = await addGroupLabel(line, value);
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

  return (
    <Box style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
      <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Icon name="tag" size={13} color={sub} />
        <Text style={{ color: sub, fontSize: 13, fontFamily: 'Calibre-Medium' }}>LABELS</Text>
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
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={() => { void add(); }}
            placeholder="Add a label"
            placeholderTextColor={sub}
            maxLength={MAX_LABEL_LEN}
            returnKeyType="done"
            editable={!busy}
            style={{
              flex: 1, color: fg, backgroundColor: rowBg,
              borderWidth: 1, borderColor: border, borderRadius: 10,
              paddingHorizontal: 10, paddingVertical: 8, fontSize: 14,
            }}
          />
          <Pressable
            onPress={() => { void add(); }}
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
            <Text style={{ color: fg, fontSize: 13, fontFamily: 'Calibre-Medium' }}>Add</Text>
          </Pressable>
        </Box>
      ) : (
        <Text style={{ color: sub, fontSize: 12, marginTop: 8, fontFamily: 'Calibre-Medium' }}>
          Label limit reached ({MAX_LABELS}).
        </Text>
      )}
    </Box>
  );
}
