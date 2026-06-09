/** Group GITHUB LINK section — set/edit the linked GitHub issue/PR URL stored
 *  in the group's synced `appData` (Linear-style linked item). Validates a
 *  github.com URL and saves it; any member may edit. Backed by lib/xmtp.github
 *  (merge-preserving write so labels survive). */

import { useEffect, useState } from 'react';
import { fontSize } from '@metro-labs/kit/tokens';
import { Linking } from 'react-native';
import { Pressable } from '@metro-labs/kit/pressable';
import { Input } from '@metro-labs/kit/input';
import { Text } from '@metro-labs/kit/text';
import { Icon } from '@metro-labs/kit/icon';
import { Box } from '../../components/layout';
import { Spinner } from '../../components/Spinner';
import { flash } from '../../lib/toast';
import { LabelPermissionError } from '../../modules/messaging';
import { getGithubLink, setGithubLink } from '../../modules/messaging';

interface Pal { fg: string; head: string; sub: string; border: string; rowBg: string; inputBg: string; }

export function GroupGithubSection({ line, p }: { line: string; p: Pal }): React.ReactElement {
  const { fg, sub, border, inputBg } = p;
  const [url, setUrl] = useState<string | undefined>(undefined);
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getGithubLink(line).then((v) => {
      if (cancelled) return;
      setUrl(v);
      setDraft(v ?? '');
    }).catch(() => undefined);
    return (): void => { cancelled = true; };
  }, [line]);

  const reportError = (e: unknown): void => {
    if (e instanceof LabelPermissionError) flash(e.message);
    else flash(e instanceof Error ? e.message : 'Could not save link. Try again.');
  };

  const save = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    try {
      const next = await setGithubLink(line, draft);
      setUrl(next);
      setDraft(next ?? '');
      setEditing(false);
    } catch (e) { reportError(e); } finally { setBusy(false); }
  };

  return (
    <Box style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
      <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Icon name="code" size={13} color={sub} />
        <Text size="sm" style={{ color: sub }}>GITHUB</Text>
      </Box>

      {url && !editing ? (
        <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}>
          <Pressable
            onPress={() => { void Linking.openURL(url); }}
            style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.6 : 1 })}
          >
            <Text size="md" numberOfLines={1} style={{ color: fg }}>
              {url.replace(/^https?:\/\/(www\.)?github\.com\//, '')}
            </Text>
          </Pressable>
          <Pressable onPress={() => { setDraft(url); setEditing(true); }} hitSlop={8} style={{ padding: 4 }}>
            <Icon name="pencil" size={16} color={sub} />
          </Pressable>
        </Box>
      ) : (
        <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}>
          <Input
            value={draft}
            onChangeText={setDraft}
            onSubmit={() => { void save(); }}
            placeholder="Link a github.com issue or PR"
            placeholderTextColor={sub}
            inputType="url"
            disabled={busy}
            inputProps={{ autoCapitalize: 'none', autoCorrect: false, returnKeyType: 'done' }}
            style={{
              flex: 1, color: fg, backgroundColor: inputBg,
              borderWidth: 1, borderColor: border, borderRadius: 10,
              paddingHorizontal: 10, paddingVertical: 8, fontSize: fontSize('md'),
            }}
          />
          <Pressable
            onPress={() => { void save(); }}
            disabled={busy}
            hitSlop={8}
            style={({ pressed }) => ({
              flexDirection: 'row', alignItems: 'center', gap: 4,
              paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
              borderWidth: 1, borderColor: border,
              opacity: busy ? 0.5 : 1,
              backgroundColor: pressed ? border : 'transparent',
            })}
          >
            {busy ? <Spinner size={14} color={fg} /> : <Icon name="check" size={14} color={fg} />}
            <Text size="sm" style={{ color: fg }}>Save</Text>
          </Pressable>
        </Box>
      )}
    </Box>
  );
}
