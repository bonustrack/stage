/** Channels search bar (rendered directly under the home topnav) + the pure
 *  client-side row filter it drives. Matches a channel by title, last-message
 *  preview, or DM peer address. Empty query returns the list unchanged. */

import { forwardRef } from 'react';
import { Pressable } from 'react-native';
import { Icon } from '@metro-labs/kit/icon';
import { Input } from '@metro-labs/kit/input';
import { Box, Row } from '../layout';
import { useBlockRadius } from '../../lib/theme';
import type { Row as RowT } from './HomeScreen.helpers';

/** Filter the already-sorted (and archive/label-filtered) rows by a free-text
 *  query. Case-insensitive substring match across title, last preview and the
 *  DM peer address. Empty/whitespace query returns the input untouched. */
export function filterRowsByQuery(rows: RowT[], query: string): RowT[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((r) => {
    const hay = [r.title, r.lastPreview, r.peerAddress ?? '']
      .join(' ')
      .toLowerCase();
    return hay.includes(q);
  });
}

/** The search section: a toolbarBg band (continuous with the topnav) holding an
 *  inset inputBg field with a leading search glyph and a trailing clear button
 *  when non-empty. Styled with app tokens + Calibre. */
export const ChannelsSearchBar = forwardRef<React.ComponentRef<typeof Input>, {
  query: string;
  setQuery: (v: string) => void;
  head: string;
  sub: string;
  border: string;
  rowBg: string;
  toolbarBg: string;
}>(function ChannelsSearchBar(props, ref): React.ReactElement {
  const { head, sub, rowBg, toolbarBg } = props;
  const blockRadius = useBlockRadius();
  return (
    <Row align="center" px={12} pt={10} pb={10} bg={toolbarBg}>
      <Box style={{
        flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: rowBg, borderRadius: blockRadius,
        paddingHorizontal: 14, paddingVertical: 8,
      }}>
        <Icon name="search" size={22} color={sub} />
        <Input
          ref={ref}
          value={props.query}
          onChangeText={props.setQuery}
          placeholder="Search"
          placeholderTextColor={sub}
          inputProps={{ autoCapitalize: 'none', autoCorrect: false, returnKeyType: 'search' }}
          style={{ flex: 1, color: head, fontSize: 19, lineHeight: 23, fontFamily: 'Calibre-Medium', padding: 0,
            backgroundColor: 'transparent', minHeight: 0, borderWidth: 0 }}
        />
        {props.query.length > 0 ? (
          <Pressable onPress={() => props.setQuery('')} hitSlop={8}>
            <Icon name="x" size={16} color={sub} />
          </Pressable>
        ) : null}
      </Box>
    </Row>
  );
});
