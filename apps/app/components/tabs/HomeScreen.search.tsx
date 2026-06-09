/** Channels search: the pure client-side row filter + the expanding search
 *  field that overlays the home topnav. A search icon in the topnav opens a
 *  full-width input (with a leading back chevron); closing it clears the query
 *  and collapses back to the normal topnav. */

import { forwardRef } from 'react';
import { fontSize } from '@metro-labs/kit/tokens';
import { Pressable } from '@metro-labs/kit/pressable';
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

/** The expanded search bar: occupies the entire topnav width. A back chevron on
 *  the left collapses search (clearing the query); an inset inputBg field holds
 *  the query with a leading search glyph + trailing clear button. Autofocuses
 *  on mount (the parent only renders it while search is open). */
export const ChannelsSearchBar = forwardRef<React.ComponentRef<typeof Input>, {
  query: string;
  setQuery: (v: string) => void;
  onClose: () => void;
  head: string;
  sub: string;
  inputBg: string;
  toolbarBg: string;
}>(function ChannelsSearchBar(props, ref): React.ReactElement {
  const { head, sub, inputBg, toolbarBg } = props;
  const blockRadius = useBlockRadius();
  return (
    <Row align="center" gap={8} px={12} pt={12} pb={10} bg={toolbarBg}>
      <Pressable onPress={props.onClose} hitSlop={8}>
        <Icon name="arrowLeft" size={22} color={head} />
      </Pressable>
      <Box style={{
        flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: inputBg, borderRadius: blockRadius,
        paddingHorizontal: 14, paddingVertical: 8,
      }}>
        <Icon name="search" size={22} color={sub} />
        <Input
          ref={ref}
          autoFocus
          value={props.query}
          onChangeText={props.setQuery}
          placeholder="Search"
          placeholderTextColor={sub}
          inputProps={{ autoCapitalize: 'none', autoCorrect: false, returnKeyType: 'search' }}
          style={{ flex: 1, color: head, fontSize: fontSize('4xl'), lineHeight: 23, fontFamily: 'Calibre-Medium', padding: 0,
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
