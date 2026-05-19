/** ChatGPT-dark-style messenger row: user gets a bubble (right), assistant is bubble-less (left). */

import { useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { HeroIcon } from './HeroIcon';
import { MessengerAudioPlayer } from './MessengerAudioPlayer';
import { MessengerImageAttachment } from './MessengerImageAttachment';
import type { HistoryEntry } from '../lib/types';

const MESSENGER_USER = 'metro://messenger/user/owner';
const REACT_PRESETS = ['👍', '❤️', '😂', '😮', '🔥', '🎉'];

interface Attachment { id: string; url: string; kind: string; mime: string; size: number; name?: string }

function fmtTs(ts: string): string {
  try { return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }); }
  catch { return ts.slice(11, 16); }
}

function attachmentsOf(entry: HistoryEntry): Attachment[] {
  const p = entry.payload as { attachments?: Attachment[] } | undefined;
  return Array.isArray(p?.attachments) ? p.attachments : [];
}

function AttachmentView({ att, fullUrl, fg, sub }: {
  att: Attachment; fullUrl: string; fg: string; sub: string;
}): React.ReactElement {
  if (att.kind === 'image') return <MessengerImageAttachment uri={fullUrl} />;
  if (att.kind === 'audio') {
    return <MessengerAudioPlayer uri={fullUrl} fg={fg} sub={sub} />;
  }
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
      <HeroIcon name="paperClip" size={16} color={fg} />
      <Text style={{ color: fg, fontSize: 13, flexShrink: 1 }} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

function markdownStyles(fg: string, dark: boolean): Record<string, object> {
  const codeBg = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  /** react-native-markdown-display creates its own <Text> elements that bypass Text.defaultProps —
   *  so we have to pin Calibre on the markdown body explicitly or it falls back to system. */
  return {
    body: { color: fg, fontSize: 15, lineHeight: 21, fontFamily: 'Calibre-Medium' },
    paragraph: { marginTop: 0, marginBottom: 0 },
    heading1: { color: fg, fontSize: 20, fontFamily: 'Calibre-Semibold', marginTop: 4, marginBottom: 2 },
    heading2: { color: fg, fontSize: 18, fontFamily: 'Calibre-Semibold', marginTop: 4, marginBottom: 2 },
    heading3: { color: fg, fontSize: 16, fontFamily: 'Calibre-Semibold', marginTop: 4, marginBottom: 2 },
    strong: { fontFamily: 'Calibre-Semibold' },
    em: { fontStyle: 'italic' },
    link: { color: fg, textDecorationLine: 'underline' },
    code_inline: { backgroundColor: codeBg, paddingHorizontal: 4, borderRadius: 4, fontFamily: 'Menlo' },
    fence: { backgroundColor: codeBg, padding: 8, borderRadius: 6, fontFamily: 'Menlo', fontSize: 13 },
    bullet_list: { marginTop: 2, marginBottom: 2 },
    ordered_list: { marginTop: 2, marginBottom: 2 },
    blockquote: { borderLeftWidth: 3, borderLeftColor: codeBg, paddingLeft: 8, marginVertical: 4 },
  };
}

export function MessengerBubble({
  entry, dark, unread, onPress, onReact, onReply, replyPreview, reactions, transcript, daemonUrl, token,
}: {
  entry: HistoryEntry; dark: boolean; unread: boolean; onPress: () => void;
  onReact?: (emoji: string) => void;
  onReply?: () => void;
  replyPreview?: string;
  reactions?: Map<string, number>;
  transcript?: string;
  daemonUrl: string; token: string;
}): React.ReactElement {
  const mine = entry.from === MESSENGER_USER;
  const atts = attachmentsOf(entry);
  const bubbleBg = mine ? (dark ? '#ffffff' : '#1a1f29') : 'transparent';
  const fg = mine
    ? (dark ? '#000000' : '#ffffff')
    : (dark ? '#e8ecf2' : '#1a1f29');
  const sub = dark ? '#8a94a6' : '#5a6477';
  const pillBg = dark ? '#1d2230' : '#eef1f7';
  const [pickerOpen, setPickerOpen] = useState(false);
  const markdownProps = {
    onLinkPress: (url: string): boolean => { void Linking.openURL(url); return false; },
    style: markdownStyles(fg, dark),
  };
  return (
    <View style={{
      flexDirection: 'column',
      alignItems: mine ? 'flex-end' : 'flex-start',
      paddingHorizontal: 12, paddingVertical: mine ? 3 : 6,
    }}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => ({
          maxWidth: mine ? '78%' : '100%',
          backgroundColor: bubbleBg,
          opacity: pressed ? 0.85 : 1,
          paddingHorizontal: mine ? 14 : 0, paddingVertical: mine ? 9 : 0,
          borderTopLeftRadius: 20, borderTopRightRadius: 20,
          borderBottomLeftRadius: mine ? 20 : 0,
          borderBottomRightRadius: mine ? 6 : 0,
          borderWidth: unread && mine ? 1.5 : 0,
          borderColor: unread ? (dark ? '#ffffff' : '#1a1f29') : 'transparent',
        })}
      >
        {replyPreview ? (
          <View style={{
            alignSelf: 'stretch', borderLeftWidth: 2, borderLeftColor: mine ? fg : sub,
            paddingLeft: 6, marginBottom: 4, opacity: 0.7,
          }}>
            <Text style={{ color: mine ? fg : fg, fontSize: 12, fontStyle: 'italic' }} numberOfLines={2}>
              {replyPreview}
            </Text>
          </View>
        ) : null}
        {atts.length > 0 ? <View style={{ alignSelf: 'stretch' }}>{atts.map(a => (
          <AttachmentView
            key={a.id}
            att={a}
            fg={fg}
            sub={sub}
            fullUrl={`${daemonUrl.replace(/\/$/, '')}${a.url}?token=${encodeURIComponent(token)}`}
          />
        ))}</View> : null}
        {/** Markdown wrapped so the lib's internal layout can't bleed into the timestamp row below. */}
        {entry.text ? (
          <View style={{ alignSelf: 'stretch' }}>
            <Markdown {...markdownProps}>{entry.text}</Markdown>
          </View>
        ) : null}
        {transcript ? (
          <Text style={{ color: mine ? fg : sub, opacity: 0.75, fontSize: 13, fontStyle: 'italic', marginTop: atts.length ? 4 : 0 }}>
            “{transcript}”
          </Text>
        ) : null}
        <View style={{
          alignSelf: 'stretch',
          flexDirection: 'row', alignItems: 'center',
          justifyContent: mine ? 'flex-end' : 'flex-start',
          gap: 6, marginTop: 3,
        }}>
          {onReact ? (
            <Pressable onPress={() => setPickerOpen(o => !o)} hitSlop={8}>
              <HeroIcon name="faceSmile" size={14} color={mine ? fg : sub} />
            </Pressable>
          ) : null}
          {onReply ? (
            <Pressable onPress={onReply} hitSlop={8}>
              <HeroIcon name="reply" size={14} color={mine ? fg : sub} />
            </Pressable>
          ) : null}
          <Text style={{
            color: mine ? fg : sub, opacity: mine ? 0.55 : 1, fontSize: 10,
          }}>{fmtTs(entry.ts)}</Text>
        </View>
      </Pressable>
      {reactions && reactions.size > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4, maxWidth: '78%' }}>
          {[...reactions.entries()].map(([emoji, count]) => (
            <View key={emoji} style={{
              flexDirection: 'row', alignItems: 'center', gap: 4,
              paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: pillBg,
            }}>
              <Text style={{ fontSize: 13 }}>{emoji}</Text>
              <Text style={{ fontSize: 11, color: sub }}>{count}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {pickerOpen ? (
        <View style={{
          flexDirection: 'row', gap: 8, marginTop: 6, paddingHorizontal: 10, paddingVertical: 6,
          borderRadius: 999, backgroundColor: dark ? '#1d2230' : '#ffffff',
          shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, elevation: 4,
        }}>
          {REACT_PRESETS.map(e => (
            <Pressable
              key={e}
              onPress={() => { onReact?.(e); setPickerOpen(false); }}
            ><Text style={{ fontSize: 22 }}>{e}</Text></Pressable>
          ))}
          <Pressable onPress={() => setPickerOpen(false)}>
            <Text style={{ fontSize: 16, color: sub, paddingHorizontal: 4 }}>✕</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
