/** @file Collapsible per-file section for the in-app PR diff viewer: a header (filename + add/del counts) toggling a kind-colored patch body with a line-number gutter, fed by diffParse. */

import { useState } from 'react';

import { Scroll as ScrollView } from '@metro-labs/kit/scroll';
import { Text } from '@metro-labs/kit/text';
import { Icon } from '@metro-labs/kit/icon';
import { ListViewItem } from '@metro-labs/kit/list-view';
import { Box, Row } from './layout';
import type { Palette } from '../lib/theme';
import type { DiffFile, DiffLine } from '../lib/diffParse';


/** Line Bg. */
function lineBg(kind: DiffLine['kind'], dark: boolean): string {
  if (kind === 'add') return dark ? 'rgba(63,185,80,0.15)' : 'rgba(46,160,67,0.12)';
  if (kind === 'del') return dark ? 'rgba(248,81,73,0.15)' : 'rgba(248,81,73,0.12)';
  if (kind === 'hunk') return dark ? 'rgba(56,139,253,0.12)' : 'rgba(56,139,253,0.10)';
  return 'transparent';
}

/** Line Color. */
function lineColor(kind: DiffLine['kind'], p: Palette): string {
  if (kind === 'add') return p.success;
  if (kind === 'del') return p.danger;
  if (kind === 'hunk' || kind === 'meta') return p.link;
  return p.text;
}

/** Marker helper. */
function marker(kind: DiffLine['kind']): string {
  if (kind === 'add') return '+';
  if (kind === 'del') return '-';
  return ' ';
}

/** Gutter helper. */
function gutter(n: number | null): string {
  return n === null ? '' : String(n);
}

/** Renders one collapsible per-file diff section with colored patch lines and a line-number gutter. */
export function FileDiff({ file, p, dark }: {
  file: DiffFile; p: Palette; dark: boolean;
}): React.ReactElement {
  const [open, setOpen] = useState(false);
  return (
    <Box>
      <ListViewItem dark={dark} gap={8} onPress={() => { setOpen(o => !o); }}>
        <Icon name={open ? 'chevronDown' : 'chevronRight'} size={16} color={p.text}/>
        <Text size="xs" numberOfLines={1} color={p.text} style={{ flex: 1}}>
          {file.filename}
        </Text>
        <Text size="xs" role="success">+{file.additions}</Text>
        <Text size="xs" role="danger">-{file.deletions}</Text>
      </ListViewItem>
      {open ? (
        file.noPatch ? (
          <Box padding={{ x: 16, bottom: 10 }}>
            <Text size="xs" color={p.text} style={{ opacity: 0.6 }}>
              No textual diff (binary or too large to display).
            </Text>
          </Box>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <Box>
              {file.lines.map((ln, i) => (
                <Row background={lineBg(ln.kind, dark)} minWidth={'100%'} key={i}>
                  {ln.kind === 'hunk' ? null : (
                    <Row style={{ borderRightWidth: 1, borderRightColor: p.border }}>
                      <Text size="3xs" color={p.text} style={{ width: 36, textAlign: 'right', opacity: 0.4, lineHeight: 18, paddingRight: 4 }}>
                        {gutter(ln.oldLine)}
                      </Text>
                      <Text size="3xs" color={p.text} style={{ width: 36, textAlign: 'right', opacity: 0.4, lineHeight: 18, paddingRight: 4 }}>
                        {gutter(ln.newLine)}
                      </Text>
                    </Row>
                  )}
                  <Text size="xs" color={lineColor(ln.kind, p)} style={{ width: 12, marginLeft: 6, lineHeight: 18 }}>
                    {marker(ln.kind)}
                  </Text>
                  <Text size="xs" color={lineColor(ln.kind, p)} style={{ lineHeight: 18, paddingRight: 12 }}>
                    {ln.text || ' '}
                  </Text>
                </Row>
              ))}
            </Box>
          </ScrollView>
        )
      ) : null}
    </Box>
  );
}
