/** Channels search bar (rendered directly under the home topnav) + the pure
 *  client-side row filter it drives. Matches a channel by title, last-message
 *  preview, or DM peer address. Empty query returns the list unchanged. */

import { forwardRef } from 'react';
import { Pressable, TextInput } from 'react-native';
import { Icon } from '@metro-labs/kit/icon';
import { Box, Row } from '../layout';
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

/** The search input bar: rounded surface with a leading search glyph and a
 *  trailing clear button when non-empty. Styled with app tokens + Calibre. */
export const ChannelsSearchBar = forwardRef<TextInput, {
  query: string;
  setQuery: (v: string) => void;
  head: string;
  sub: string;
  border: string;
  rowBg: string;
}>(function ChannelsSearchBar(props, ref): React.ReactElement {
  const { head, sub, border, rowBg } = props;
  return (
    <Row align="center" px={12} pt={10} pb={10} style={{
      borderBottomWidth: 1, borderBottomColor: border,
    }}>
      <Box style={{
        flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: rowBg, borderRadius: 999,
        paddingHorizontal: 14, paddingVertical: 8,
      }}>
        <Icon name="search" size={18} color={sub} />
        <TextInput
          ref={ref}
          value={props.query}
          onChangeText={props.setQuery}
          placeholder="Search channels"
          placeholderTextColor={sub}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          style={{ flex: 1, color: head, fontSize: 16, fontFamily: 'Calibre-Medium', padding: 0 }}
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
