/** Search bar + empty/results/no-match layout pieces for SearchScreen.
 *  Extracted from SearchScreen.rows.tsx (mechanical split, behavior identical). */
import { forwardRef } from 'react';
import { Pressable, TextInput } from 'react-native';
import { Text } from '@metro-labs/kit/text';
import { Icon } from '@metro-labs/kit/icon';
import { shortAddress } from '../../lib/xmtp';
import { getPeerName, getPeerAvatarCb, isPeerResolved } from '../../lib/peerProfiles';
import { Box, Col, Row } from '../layout';
import { Spinner } from '../Spinner';
import { ChannelRow } from '../ChannelRow';
import type { ConvRow } from './SearchScreen.helpers';
import { AddressResult } from './SearchScreen.rows';

interface Palette { fg: string; head: string; sub: string; border: string }

/** The search input bar (icon + text field + clear button). */
export const SearchBar = forwardRef<TextInput, {
  pal: { head: string; sub: string; border: string; rowBg: string };
  query: string;
  setQuery: (v: string) => void;
}>(function SearchBar(props, ref): React.ReactElement {
  const { head, sub, border, rowBg } = props.pal;
  return (
    <Row align="center" gap={8} px={12} pt={12} pb={10} style={{
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
          placeholder="Search messages, people, addresses"
          placeholderTextColor={sub}
          autoCapitalize="none"
          autoCorrect={false}
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

/** Empty state shown before any query is entered. */
export function SearchEmptyState({ sub }: { sub: string }): React.ReactElement {
  return (
    <Col flex={1} align="center" justify="center" p={32}>
      <Icon name="search" size={40} color={sub} />
      <Text style={{ color: sub, fontSize: 15, fontFamily: 'Calibre-Medium', textAlign: 'center', marginTop: 12 }}>
        Search messages, people, addresses
      </Text>
    </Col>
  );
}

interface ResultsHeaderProps {
  pal: Palette;
  sectionHeader: (label: string) => React.ReactElement;
  resolved: { address: string; source: 'address' | 'ens' } | null;
  query: string;
  opening: string | null;
  onOpenAddress: (address: string) => void;
  convHits: ConvRow[];
  onOpenConv: (convId: string) => void;
  msgHasHits: boolean;
  searching: boolean;
}

/** The FlatList ListHeaderComponent: address result + conversation matches +
 *  the MESSAGES section header / searching spinner. */
export function SearchResultsHeader(props: ResultsHeaderProps): React.ReactElement {
  const { pal, sectionHeader, resolved, query: q, convHits } = props;
  const { head, sub } = pal;
  return (
    <>
      {/* Address / ENS "start a chat" result */}
      {resolved ? (
        <>
          {sectionHeader('ADDRESS')}
          <AddressResult pal={pal} resolved={resolved} query={q} opening={props.opening} onPress={props.onOpenAddress} />
        </>
      ) : null}

      {/* Conversation matches */}
      {convHits.length > 0 ? sectionHeader('CONVERSATIONS') : null}
      {convHits.map(r => {
        const displayTitle = r.peerAddress ? (getPeerName(r.peerAddress) ?? r.title) : r.title;
        const showAddr = !r.avatarUri && r.avatarAddress && isPeerResolved(r.avatarAddress)
          ? r.avatarAddress : null;
        return (
          <ChannelRow
            key={r.convId}
            title={displayTitle}
            avatarUri={r.avatarUri}
            avatarAddress={showAddr}
            cacheBuster={r.avatarAddress ? getPeerAvatarCb(r.avatarAddress) : undefined}
            square={!r.peerAddress}
            subtitle={r.peerAddress ? shortAddress(r.peerAddress) : null}
            onPress={() => props.onOpenConv(r.convId)}
          />
        );
      })}

      {/* Messages section header (rows are the FlatList data) */}
      {props.msgHasHits ? sectionHeader('MESSAGES') : null}
      {props.searching ? (
        <Row align="center" justify="center" py={16} gap={8}>
          <Spinner size={16} color={head} />
          <Text style={{ color: sub, fontSize: 13, fontFamily: 'Calibre-Medium' }}>Searching…</Text>
        </Row>
      ) : null}
    </>
  );
}

/** The FlatList ListFooterComponent: the no-matches message. */
export function SearchNoMatches({ sub, query }: { sub: string; query: string }): React.ReactElement {
  return (
    <Text style={{ color: sub, fontSize: 14, fontFamily: 'Calibre-Medium', textAlign: 'center', paddingVertical: 32, paddingHorizontal: 24 }}>
      No matches for “{query}”.
    </Text>
  );
}
