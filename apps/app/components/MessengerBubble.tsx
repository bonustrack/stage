/** ChatGPT-dark-style chat bubble — right for owner, left for everyone else. */

import { Image, Linking, Pressable, Text, View } from 'react-native';
import type { HistoryEntry } from '../lib/types';

const MESSENGER_USER = 'metro://messenger/user/owner';

interface Attachment { id: string; url: string; kind: string; mime: string; size: number; name?: string }

function fmtTs(ts: string): string {
  try { return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }); }
  catch { return ts.slice(11, 16); }
}

function attachmentsOf(entry: HistoryEntry): Attachment[] {
  const p = entry.payload as { attachments?: Attachment[] } | undefined;
  return Array.isArray(p?.attachments) ? p.attachments : [];
}

function AttachmentView({ att, fullUrl, fg }: {
  att: Attachment; fullUrl: string; fg: string;
}): React.ReactElement {
  if (att.kind === 'image') {
    return (
      <Image
        source={{ uri: fullUrl }}
        style={{ width: 220, height: 220, borderRadius: 10, marginBottom: 6 }}
        resizeMode="cover"
      />
    );
  }
  const icon = att.kind === 'audio' ? '🎤' : '📎';
  const label = att.name ?? `${att.kind} attachment`;
  return (
    <Pressable
      onPress={() => void Linking.openURL(fullUrl)}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 8,
        paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
        backgroundColor: 'rgba(0,0,0,0.12)', marginBottom: 6,
      }}
    >
      <Text style={{ color: fg, fontSize: 14 }}>{icon}</Text>
      <Text style={{ color: fg, fontSize: 13, flexShrink: 1 }} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

export function MessengerBubble({ entry, dark, unread, onPress, daemonUrl, token }: {
  entry: HistoryEntry; dark: boolean; unread: boolean; onPress: () => void;
  daemonUrl: string; token: string;
}): React.ReactElement {
  const mine = entry.from === MESSENGER_USER;
  const bg = mine ? (dark ? '#ffffff' : '#1a1f29') : (dark ? '#2a2d33' : '#eef1f7');
  const fg = mine ? (dark ? '#000000' : '#ffffff') : (dark ? '#e8ecf2' : '#1a1f29');
  const atts = attachmentsOf(entry);
  return (
    <View style={{
      flexDirection: 'row',
      justifyContent: mine ? 'flex-end' : 'flex-start',
      paddingHorizontal: 12, paddingVertical: 3,
    }}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => ({
          maxWidth: '78%',
          backgroundColor: bg,
          opacity: pressed ? 0.85 : 1,
          paddingHorizontal: 14, paddingVertical: 9,
          borderTopLeftRadius: 20, borderTopRightRadius: 20,
          borderBottomLeftRadius: mine ? 20 : 6,
          borderBottomRightRadius: mine ? 6 : 20,
          borderWidth: unread ? 1.5 : 0,
          borderColor: unread ? (dark ? '#ffffff' : '#1a1f29') : 'transparent',
        })}
      >
        {atts.map(a => (
          <AttachmentView
            key={a.id}
            att={a}
            fg={fg}
            fullUrl={`${daemonUrl.replace(/\/$/, '')}${a.url}?token=${encodeURIComponent(token)}`}
          />
        ))}
        {entry.text ? (
          <Text style={{ color: fg, fontSize: 15, lineHeight: 20 }}>{entry.text}</Text>
        ) : null}
        <Text style={{
          color: fg, opacity: 0.55, fontSize: 10, marginTop: 3,
          textAlign: mine ? 'right' : 'left',
        }}>{fmtTs(entry.ts)}</Text>
      </Pressable>
    </View>
  );
}
