/** One collapsible per-file section for the in-app PR diff viewer. Renders a
 *  GitHub-style header (status dot + filename + +adds/-dels counts) that toggles
 *  the patch body, and the patch lines colored by kind (green add, red delete,
 *  neutral context, muted hunk header). Monospace, horizontally scrollable so
 *  long lines do not wrap. Pure presentational - data comes from diffParse. */

import { useState } from 'react';
import { Pressable, ScrollView } from 'react-native';
import { Text } from '@metro-labs/kit/text';
import { Icon } from '@metro-labs/kit/icon';
import { Box } from './layout';
import type { Palette } from '../lib/theme';
import type { DiffFile, DiffLine } from '../lib/diffParse';

const MONO = 'Menlo';

function lineBg(kind: DiffLine['kind'], dark: boolean): string {
  if (kind === 'add') return dark ? 'rgba(63,185,80,0.15)' : 'rgba(46,160,67,0.12)';
  if (kind === 'del') return dark ? 'rgba(248,81,73,0.15)' : 'rgba(248,81,73,0.12)';
  if (kind === 'hunk') return dark ? 'rgba(56,139,253,0.12)' : 'rgba(56,139,253,0.10)';
  return 'transparent';
}

function lineColor(kind: DiffLine['kind'], p: Palette): string {
  if (kind === 'add') return p.success;
  if (kind === 'del') return p.danger;
  if (kind === 'hunk' || kind === 'meta') return p.link;
  return p.text;
}

function marker(kind: DiffLine['kind']): string {
  if (kind === 'add') return '+';
  if (kind === 'del') return '-';
  return ' ';
}

export function FileDiff({ file, p, dark }: {
  file: DiffFile; p: Palette; dark: boolean;
}): React.ReactElement {
  const [open, setOpen] = useState(true);
  return (
    <Box style={{ borderWidth: 1, borderColor: p.border, borderRadius: 8, marginBottom: 10, overflow: 'hidden' }}>
      <Pressable
        onPress={() => setOpen(o => !o)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }}
      >
        <Icon name={open ? 'chevronDown' : 'chevronRight'} size={16} color={p.text} />
        <Text numberOfLines={1} style={{ flex: 1, color: p.text, fontFamily: MONO, fontSize: 13 }}>
          {file.filename}
        </Text>
        <Text style={{ color: p.success, fontFamily: 'Calibre-Medium', fontSize: 13 }}>+{file.additions}</Text>
        <Text style={{ color: p.danger, fontFamily: 'Calibre-Medium', fontSize: 13 }}>-{file.deletions}</Text>
      </Pressable>
      {open ? (
        file.noPatch ? (
          <Box style={{ paddingHorizontal: 12, paddingVertical: 10 }}>
            <Text style={{ color: p.text, opacity: 0.6, fontSize: 13 }}>
              No textual diff (binary or too large to display).
            </Text>
          </Box>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <Box>
              {file.lines.map((ln, i) => (
                <Box key={i} style={{ flexDirection: 'row', backgroundColor: lineBg(ln.kind, dark), paddingHorizontal: 10, minWidth: '100%' }}>
                  <Text style={{ width: 12, color: lineColor(ln.kind, p), fontFamily: MONO, fontSize: 12.5, lineHeight: 18 }}>
                    {marker(ln.kind)}
                  </Text>
                  <Text style={{ color: lineColor(ln.kind, p), fontFamily: MONO, fontSize: 12.5, lineHeight: 18 }}>
                    {ln.text || ' '}
                  </Text>
                </Box>
              ))}
            </Box>
          </ScrollView>
        )
      ) : null}
    </Box>
  );
}
