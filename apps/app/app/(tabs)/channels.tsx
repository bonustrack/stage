/** Channels screen — XMTP conversations the local wallet is a member of. */

import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Pressable, Text, View, useColorScheme,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import type { Conversation, DecodedMessage } from '@xmtp/react-native-sdk';
import { getOrCreateXmtpClient, lineOfConv, shortAddress } from '../../lib/xmtp';

interface Row { line: string; convId: string; title: string; lastTs: number | null; lastPreview: string }

function fmtTs(ts: number | null): string {
  if (!ts) return '';
  const d = new Date(ts);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

async function summarize(conv: Conversation): Promise<Row> {
  const msgs: DecodedMessage[] = await conv.messages({ limit: 1 }).catch(() => []);
  const last = msgs[0];
  /** `last.content` is a method on the RN SDK's DecodedMessage — invoke + narrow the
   *  decoded value (text codec returns a string, every other codec returns an object). */
  let preview = '';
  if (last) {
    try {
      const decoded: unknown = last.content();
      preview = typeof decoded === 'string' ? decoded : `[${last.contentTypeId ?? 'unknown'}]`;
    } catch { preview = `[${last.contentTypeId ?? 'unknown'}]`; }
  }
  /** XMTP RN SDK conv has `name` (groups), peer wallets accessible via members. For DMs, the
   *  title is the peer's address; for groups, the group name or member list. */
  const title = conv.topic.replace(/^.*\//, '').slice(0, 12);
  return {
    line: lineOfConv(conv.id),
    convId: conv.id,
    title,
    /** `sentNs` is a plain JS number (nanoseconds since epoch). Divide for ms. */
    lastTs: last?.sentNs ? Math.floor(last.sentNs / 1_000_000) : null,
    lastPreview: preview.slice(0, 80),
  };
}

export default function Channels(): React.ReactElement {
  const router = useRouter();
  const dark = useColorScheme() === 'dark';
  const fg = dark ? '#e8ecf2' : '#1a1f29';
  const sub = dark ? '#8a94a6' : '#5a6477';
  const bg = dark ? '#000000' : '#ffffff';
  const border = dark ? '#262c38' : '#e3e7ef';
  const rowBg = dark ? '#161a22' : '#fafbfd';
  const [rows, setRows] = useState<Row[] | null>(null);
  const [myAddress, setMyAddress] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    void (async (): Promise<void> => {
      try {
        const client = await getOrCreateXmtpClient('production');
        setMyAddress(client.publicIdentity.identifier);
        await client.conversations.syncAllConversations(['allowed', 'unknown']);
        const convs = await client.conversations.list(undefined, undefined, ['allowed', 'unknown']);
        const summarized = await Promise.all(convs.map(summarize));
        summarized.sort((a, b) => (b.lastTs ?? 0) - (a.lastTs ?? 0));
        setRows(summarized);
      } catch (e) { setError((e as Error).message); }
    })();
  }, []);

  if (error) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: bg }}>
        <Text style={{ color: fg, fontSize: 15 }}>{error}</Text>
      </View>
    );
  }
  if (!rows) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: bg }}>
        <ActivityIndicator />
        <Text style={{ color: sub, marginTop: 8, fontSize: 12 }}>Initialising XMTP…</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      {myAddress ? (
        <Pressable
          onPress={() => {
            void Clipboard.setStringAsync(myAddress);
            Alert.alert('Copied', myAddress);
          }}
          style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: border, backgroundColor: rowBg }}
        >
          <Text style={{ color: sub, fontSize: 11 }}>YOUR XMTP ADDRESS (tap to copy)</Text>
          <Text style={{ color: fg, fontSize: 13, fontFamily: 'monospace', marginTop: 2 }}>{shortAddress(myAddress)}</Text>
        </Pressable>
      ) : null}
      <FlatList
        data={rows}
        keyExtractor={r => r.convId}
        ListEmptyComponent={
          <View style={{ padding: 32, alignItems: 'center' }}>
            <Text style={{ color: sub }}>No conversations yet. Share your address above to start one.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push({ pathname: '/messenger', params: { line: item.line } })}
            style={({ pressed }) => ({
              backgroundColor: pressed ? border : rowBg,
              flexDirection: 'row', alignItems: 'center', gap: 10,
              paddingHorizontal: 14, paddingVertical: 12,
              borderBottomWidth: 1, borderBottomColor: border,
            })}
          >
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ color: fg, fontSize: 14, fontFamily: 'monospace' }} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={{ color: sub, fontSize: 12, marginTop: 4 }} numberOfLines={1}>
                {item.lastPreview || '(no messages yet)'}
              </Text>
            </View>
            <Text style={{ color: sub, fontSize: 12, marginLeft: 8 }}>{fmtTs(item.lastTs)}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}
