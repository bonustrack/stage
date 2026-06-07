/** One collapsible per-file section for the in-app PR diff viewer. The header is
 *  a Kit ListViewItem (status chevron + filename + +adds/-dels counts) that
 *  toggles the patch body. The body renders the patch lines colored by kind
 *  (green add, red delete, neutral context, muted hunk header) with a GitHub-
 *  style old/new line-number gutter, edge to edge and horizontally scrollable so
 *  long lines do not wrap. Calibre font. Data comes from diffParse. Designed to
 *  be composed inside a Kit ListView in diff.tsx. */

import { useState } from 'react';
import { ScrollView } from 'react-native';
import { Text } from '@metro-labs/kit/text';
import { Icon } from '@metro-labs/kit/icon';
import { ListViewItem } from '@metro-labs/kit/list-view';
import { Box } from './layout';
import type { Palette } from '../lib/theme';
import type { DiffFile, DiffLine } from '../lib/diffParse';

const FONT = 'Calibre-Medium';

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

function gutter(n: number | null): string {
  return n === null ? '' : String(n);
}

export function FileDiff({ file, p, dark }: {
  file: DiffFile; p: Palette; dark: boolean;
}): React.ReactElement {
  const [open, setOpen] = useState(false);
  return (
    <Box>
      <ListViewItem dark={dark} gap={8} onPress={() => setOpen(o => !o)}>
        <Icon name={open ? 'chevronDown' : 'chevronRight'} size={16} color={p.text} />
        <Text numberOfLines={1} style={{ flex: 1, color: p.text, fontFamily: FONT, fontSize: 13 }}>
          {file.filename}
        </Text>
        <Text style={{ color: p.success, fontFamily: FONT, fontSize: 13 }}>+{file.additions}</Text>
        <Text style={{ color: p.danger, fontFamily: FONT, fontSize: 13 }}>-{file.deletions}</Text>
      </ListViewItem>
      {open ? (
        file.noPatch ? (
          <Box style={{ paddingHorizontal: 16, paddingBottom: 10 }}>
            <Text style={{ color: p.text, opacity: 0.6, fontSize: 13, fontFamily: FONT }}>
              No textual diff (binary or too large to display).
            </Text>
          </Box>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <Box>
              {file.lines.map((ln, i) => (
                <Box key={i} style={{ flexDirection: 'row', backgroundColor: lineBg(ln.kind, dark), minWidth: '100%' }}>
                  {ln.kind === 'hunk' ? null : (
                    <Box style={{ flexDirection: 'row', borderRightWidth: 1, borderRightColor: p.border }}>
                      <Text style={{ width: 36, textAlign: 'right', color: p.text, opacity: 0.4, fontFamily: FONT, fontSize: 11.5, lineHeight: 18, paddingRight: 4 }}>
                        {gutter(ln.oldLine)}
                      </Text>
                      <Text style={{ width: 36, textAlign: 'right', color: p.text, opacity: 0.4, fontFamily: FONT, fontSize: 11.5, lineHeight: 18, paddingRight: 4 }}>
                        {gutter(ln.newLine)}
                      </Text>
                    </Box>
                  )}
                  <Text style={{ width: 12, marginLeft: 6, color: lineColor(ln.kind, p), fontFamily: FONT, fontSize: 12.5, lineHeight: 18 }}>
                    {marker(ln.kind)}
                  </Text>
                  <Text style={{ color: lineColor(ln.kind, p), fontFamily: FONT, fontSize: 12.5, lineHeight: 18, paddingRight: 12 }}>
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
