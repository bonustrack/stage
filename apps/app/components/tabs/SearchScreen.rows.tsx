/** Result-row sub-components for SearchScreen.
 *
 *  Extracted from SearchScreen.tsx (mechanical split, behavior identical). */
import { Pressable } from 'react-native';
import { Text } from '@metro-labs/kit/text';
import { Icon } from '@metro-labs/kit/icon';
import { shortAddress } from '../../lib/xmtp';
import { getPeerName, getPeerAvatarCb } from '../../lib/peerProfiles';
import { Avatar } from '../Avatar';
import { Box } from '../layout';
import { Spinner } from '../Spinner';
import type { MsgHit } from './SearchScreen.helpers';

export interface Palette { fg: string; head: string; sub: string; border: string }

export function makeSectionHeader(sub: string) {
  return (label: string): React.ReactElement => (
    <Text style={{
      color: sub, fontSize: 12, fontFamily: 'Calibre-Medium',
      paddingHorizontal: 16, paddingTop: 16, paddingBottom: 6,
    }}>{label}</Text>
  );
}

/** The address / ENS "start a chat" result row. */
export function AddressResult(props: {
  pal: Palette;
  resolved: { address: string; source: 'address' | 'ens' };
  query: string;
  opening: string | null;
  onPress: (address: string) => void;
}): React.ReactElement {
  const { fg, head, sub, border } = props.pal;
  const { resolved, query: q } = props;
  return (
    <Pressable
      onPress={() => props.onPress(resolved.address)}
      style={({ pressed }) => ({
        backgroundColor: pressed ? border : 'transparent',
        flexDirection: 'row', alignItems: 'center', gap: 12,
        paddingHorizontal: 14, paddingVertical: 14,
        borderBottomWidth: 1, borderBottomColor: border,
      })}
    >
      <Avatar
        address={resolved.address}
        size="md"
        cacheBuster={getPeerAvatarCb(resolved.address)}
        style={{ backgroundColor: border }}
      />
      <Box style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: head, fontSize: 16, fontFamily: 'Calibre-Semibold' }} numberOfLines={1}>
          {getPeerName(resolved.address) ?? (resolved.source === 'ens' ? q : shortAddress(resolved.address))}
        </Text>
        <Text style={{ color: sub, fontSize: 13, fontFamily: 'Calibre-Medium', marginTop: 2 }} numberOfLines={1}>
          {shortAddress(resolved.address)}
        </Text>
      </Box>
      {props.opening === resolved.address.toLowerCase()
        ? <Spinner size={16} color={head} />
        : <Icon name="chatRect" size={18} color={fg} />}
    </Pressable>
  );
}

/** A single message-text hit row (the FlatList item). */
export function MessageRow(props: {
  pal: Palette;
  item: MsgHit;
  onPress: (convId: string) => void;
}): React.ReactElement {
  const { head, sub, border } = props.pal;
  const { item } = props;
  return (
    <Pressable
      onPress={() => props.onPress(item.convId)}
      style={({ pressed }) => ({
        backgroundColor: pressed ? border : 'transparent',
        flexDirection: 'row', alignItems: 'center', gap: 12,
        paddingHorizontal: 14, paddingVertical: 12,
        borderBottomWidth: 1, borderBottomColor: border,
      })}
    >
      <Avatar
        address={item.peerAddress}
        size="md"
        cacheBuster={item.peerAddress ? getPeerAvatarCb(item.peerAddress) : undefined}
        square={!item.peerAddress}
        style={{ backgroundColor: border }}
      />
      <Box style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: head, fontSize: 15, fontFamily: 'Calibre-Semibold' }} numberOfLines={1}>
          {item.convTitle}
        </Text>
        <Text style={{ color: sub, fontSize: 14, fontFamily: 'Calibre-Medium', marginTop: 2 }} numberOfLines={2}>
          {item.snippet}
        </Text>
      </Box>
    </Pressable>
  );
}
// Layout pieces live in SearchScreen.layout.tsx; consumers import them from
// there directly (the re-export here was dropped to break the rows ↔ layout cycle).
