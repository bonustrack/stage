/** Discord-style messenger row: every message left-aligned, avatar at the start,
 *  no colored bubble even for the local user's own messages. */

import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Linking, PanResponder, Pressable, Text, TextInput, View } from 'react-native';
import { getPeerAvatarCb } from '../lib/peerProfiles';
import Markdown, { MarkdownIt } from 'react-native-markdown-display';
import { HeroIcon } from './HeroIcon';
import { MessengerAudioPlayer } from './MessengerAudioPlayer';
import { MessengerImageAttachment } from './MessengerImageAttachment';
import { YouTubeEmbed, LocationEmbed } from './MediaEmbeds';
import { mapCoordsOf, youtubeIdOf } from '../lib/embedDetect';
import { Avatar } from './Avatar';
import { resolveRemoteAttachment } from '../lib/xmtp';
import type { HistoryEntry } from '../lib/types';
import type { RemoteAttachmentInfo } from '@xmtp/react-native-sdk';

const REACT_PRESETS = ['👍', '❤️', '😂', '😮', '🔥', '🎉'];
/** `linkify` + `breaks` turn bare URLs into tappable links and treat `\n` as a line
 *  break, matching the markdown-it config on the web side. Constructed once at
 *  module scope — the lib re-parses input each render anyway. */
const mdParser = MarkdownIt({ typographer: false, linkify: true, breaks: true });

/** Shape covers messenger-station attachments (id+url, served by the daemon), XMTP
 *  inline attachments (dataB64 carries the raw bytes — no URL exists), and XMTP
 *  multi-remote attachments (`remote` carries the IPFS URL + decryption metadata;
 *  the bytes are fetched + decrypted lazily by `RemoteAttachmentResolver`). */
interface Attachment {
  id?: string; url?: string; dataB64?: string; remote?: RemoteAttachmentInfo;
  kind: string; mime?: string; size?: number; name?: string;
}

function fmtTs(ts: string): string {
  try { return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }); }
  catch { return ts.slice(11, 16); }
}

function attachmentsOf(entry: HistoryEntry): Attachment[] {
  const p = entry.payload as { attachments?: Attachment[] } | undefined;
  return Array.isArray(p?.attachments) ? p.attachments : [];
}

function AttachmentView({ att, fullUrl, fg, sub, dark }: {
  att: Attachment; fullUrl: string; fg: string; sub: string; dark: boolean;
}): React.ReactElement {
  if (att.kind === 'image') return <MessengerImageAttachment uri={fullUrl} dark={dark} />;
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
      <Text style={{ color: fg, fontSize: 13, flexShrink: 1 , fontFamily: 'Calibre-Medium'}} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

/** Remote (multi-remote) attachment: ciphertext lives on IPFS. Download +
 *  decrypt on mount to a local `file://` URI, then hand off to the regular
 *  `AttachmentView`. Shows a spinner while resolving and a tappable retry chip
 *  on failure (gateway hiccup / decrypt error). */
function RemoteAttachmentResolver({ att, fg, sub, dark }: {
  att: Attachment; fg: string; sub: string; dark: boolean;
}): React.ReactElement {
  const [uri, setUri] = useState<string | null>(null);
  const [mime, setMime] = useState<string | undefined>(att.mime);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!att.remote) return;
    let cancelled = false;
    setFailed(false);
    void resolveRemoteAttachment(att.remote)
      .then(r => { if (!cancelled) { setUri(r.fileUri); if (r.mimeType) setMime(r.mimeType); } })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [att.remote, attempt]);

  if (failed) {
    return (
      <Pressable
        onPress={() => setAttempt(a => a + 1)}
        style={{
          flexDirection: 'row', alignItems: 'center', gap: 8,
          paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
          backgroundColor: 'rgba(0,0,0,0.12)', marginBottom: 6,
        }}
      >
        <HeroIcon name="paperClip" size={16} color={fg} />
        <Text style={{ color: fg, fontSize: 13, flexShrink: 1, fontFamily: 'Calibre-Medium' }} numberOfLines={1}>
          {att.name ?? 'attachment'} — tap to retry
        </Text>
      </Pressable>
    );
  }
  if (!uri) {
    return (
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: 8,
        paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8,
        backgroundColor: 'rgba(0,0,0,0.12)', marginBottom: 6,
      }}>
        <ActivityIndicator size="small" color={fg} />
        <Text style={{ color: sub, fontSize: 13, fontFamily: 'Calibre-Medium' }} numberOfLines={1}>
          {att.name ?? 'attachment'}
        </Text>
      </View>
    );
  }
  return <AttachmentView att={{ ...att, mime }} fullUrl={uri} fg={fg} sub={sub} dark={dark} />;
}

function markdownStyles(fg: string, dark: boolean, mine: boolean): Record<string, object> {
  const codeBg = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  /** Tighter leading on the user's own bubble — Less prefers a snugger look there.
   *  Assistant text keeps 23 for comfortable reading on long replies. */
  const lh = mine ? 21 : 23;
  return {
    body: { color: fg, fontSize: 18, lineHeight: lh, fontFamily: 'Calibre-Medium' },
    paragraph: { marginTop: 0, marginBottom: 0 },
    heading1: { color: fg, fontSize: 20, fontFamily: 'Calibre-Semibold', marginTop: 4, marginBottom: 2 },
    heading2: { color: fg, fontSize: 18, fontFamily: 'Calibre-Semibold', marginTop: 4, marginBottom: 2 },
    heading3: { color: fg, fontSize: 16, fontFamily: 'Calibre-Semibold', marginTop: 4, marginBottom: 2 },
    /** Pin fontFamily + weight + size + lineHeight on every inline mark. The markdown
     *  lib adds a default fontWeight:'bold' on strong which makes RN look for the
     *  bold-variant of the inherited family — since Calibre-Semibold is registered as
     *  its OWN family (not a weight of Calibre-Medium), RN falls back to system bold.
     *  Pinning fontWeight:'normal' lets the explicit Calibre-Semibold family win. */
    strong: { fontFamily: 'Calibre-Semibold', fontWeight: 'normal', fontSize: 15, lineHeight: lh },
    em: { fontFamily: 'Calibre-Medium', fontStyle: 'italic', fontWeight: 'normal', fontSize: 15, lineHeight: lh },
    link: { color: fg, textDecorationLine: 'underline' },
    /** Menlo's em-square is wider than Calibre's, so size down to match. */
    code_inline: { backgroundColor: codeBg, paddingHorizontal: 4, borderRadius: 4, fontFamily: 'Menlo', fontSize: 13, lineHeight: lh },
    fence: { backgroundColor: codeBg, padding: 8, borderRadius: 6, fontFamily: 'Menlo', fontSize: 12, lineHeight: 18 },
    bullet_list: { marginTop: 2, marginBottom: 2 },
    ordered_list: { marginTop: 2, marginBottom: 2 },
    blockquote: { borderLeftWidth: 3, borderLeftColor: codeBg, paddingLeft: 8, marginVertical: 4 },
  };
}

interface QuestionOption { label: string; description?: string }
interface Question {
  header?: string;
  options: QuestionOption[];
  multiSelect?: boolean;
  /** Default true. When true, an "Other…" affordance lets the user type a free-text
   *  answer instead of (or in addition to, for multi-select) the listed options. */
  allowOther?: boolean;
}

function questionOf(entry: HistoryEntry): Question | undefined {
  const p = entry.payload as { question?: Question } | undefined;
  if (!p?.question || !Array.isArray(p.question.options)) return undefined;
  return p.question;
}

/** Question view — single-select fires onAnswer instantly; multi-select toggles
 *  options locally and submits the joined labels as one message on tap of "Submit".
 *  An implicit "Other…" affordance (default on) lets the user type a free-text
 *  answer instead of (or alongside, in multi mode) the listed options. */
function QuestionView({ question, dark, sub, onAnswer }: {
  question: Question; dark: boolean; sub: string; onAnswer: (label: string) => void;
}): React.ReactElement {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [otherOpen, setOtherOpen] = useState(false);
  const [otherText, setOtherText] = useState('');
  const multi = question.multiSelect === true;
  const allowOther = question.allowOther !== false;
  const toggle = (label: string): void => {
    if (!multi) { onAnswer(label); return; }
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label); else next.add(label);
      return next;
    });
  };
  const submit = (): void => {
    /** Preserve the user's option order so the answer reads naturally. */
    const chosen = question.options.filter(o => selected.has(o.label)).map(o => o.label);
    const other = otherText.trim();
    if (multi) {
      if (chosen.length === 0 && !other) return;
      onAnswer([...chosen, ...(other ? [other] : [])].join(', '));
    } else {
      /** Single-select Other submit — just send the typed text. */
      if (!other) return;
      onAnswer(other);
    }
  };
  const needSubmitButton = multi || otherOpen;
  return (
    <View style={{ alignSelf: 'stretch', gap: 6, marginTop: 8 }}>
      {question.header ? (
        <Text style={{ color: sub, fontSize: 11, fontFamily: 'Calibre-Semibold', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {question.header}{multi ? ' · multi-select' : ''}
        </Text>
      ) : null}
      {question.options.map((opt, i) => {
        const isOn = selected.has(opt.label);
        return (
          <Pressable
            key={`${i}-${opt.label}`}
            onPress={() => toggle(opt.label)}
            style={({ pressed }) => ({
              paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12,
              backgroundColor: isOn
                ? (dark ? 'rgba(192,160,110,0.22)' : 'rgba(192,160,110,0.18)')
                : pressed
                  ? (dark ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.08)')
                  : (dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)'),
              borderWidth: 1,
              borderColor: isOn
                ? '#c0a06e'
                : (dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)'),
            })}
          >
            <Text style={{ color: dark ? '#9f9fa3' : '#57606a', fontSize: 15, fontFamily: 'Calibre-Medium' }}>
              {multi ? (isOn ? '☑︎  ' : '☐  ') : ''}{opt.label}
            </Text>
            {opt.description ? (
              <Text style={{ color: sub, fontSize: 12, fontFamily: 'Calibre-Medium', marginTop: 2 }}>
                {opt.description}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
      {allowOther && !otherOpen ? (
        <Pressable
          onPress={() => setOtherOpen(true)}
          style={({ pressed }) => ({
            paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12,
            backgroundColor: pressed
              ? (dark ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.08)')
              : (dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)'),
            borderWidth: 1, borderStyle: 'dashed',
            borderColor: dark ? 'rgba(255,255,255,0.20)' : 'rgba(0,0,0,0.18)',
          })}
        >
          <Text style={{ color: sub, fontSize: 15, fontFamily: 'Calibre-Medium' }}>
            Other…
          </Text>
        </Pressable>
      ) : null}
      {otherOpen ? (
        <View style={{
          paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12,
          backgroundColor: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
          borderWidth: 1, borderColor: dark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.14)',
        }}>
          <TextInput
            value={otherText}
            onChangeText={setOtherText}
            placeholder="Type your answer…"
            placeholderTextColor={sub}
            multiline
            autoFocus
            onSubmitEditing={submit}
            blurOnSubmit
            style={{
              color: dark ? '#9f9fa3' : '#57606a',
              fontFamily: 'Calibre-Medium', fontSize: 15, lineHeight: 22,
              minHeight: 22, padding: 0,
            }}
          />
        </View>
      ) : null}
      {needSubmitButton ? (
        <Pressable
          onPress={submit}
          disabled={multi ? (selected.size === 0 && !otherText.trim()) : !otherText.trim()}
          style={({ pressed }) => {
            const disabled = multi
              ? (selected.size === 0 && !otherText.trim())
              : !otherText.trim();
            return {
              marginTop: 4, alignSelf: 'flex-start',
              paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
              backgroundColor: disabled
                ? (dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)')
                : pressed ? '#a08458' : '#c0a06e',
              opacity: disabled ? 0.5 : 1,
            };
          }}
        >
          <Text style={{ color: '#000', fontSize: 14, fontFamily: 'Calibre-Semibold' }}>
            Submit{multi && selected.size > 0 ? ` (${selected.size}${otherText.trim() ? '+1' : ''})` : ''}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function MessengerBubble({
  entry, dark, unread, pending, replyTarget, onReact, onReply, onLongPress, onAnswer,
  replyPreview, onReplyPreviewPress, reactions, transcript, myUri, senderEthAddress, onAvatarPress,
}: {
  entry: HistoryEntry; dark: boolean; unread: boolean; pending?: boolean; replyTarget?: boolean;
  onReact?: (emoji: string) => void; onReply?: () => void; onLongPress?: () => void;
  /** Tap the quoted reply-preview slab → parent jumps/scrolls to the original
   *  message. No-op when undefined (e.g. a bubble that isn't a reply). */
  onReplyPreviewPress?: () => void;
  /** Tapping a question option fires this with the chosen label (parent sends it as
   *  a normal user message with replyTo=entry.id so the agent links the answer to
   *  the question). */
  onAnswer?: (label: string) => void;
  replyPreview?: string; reactions?: Map<string, number>; transcript?: string;
  /** Self URI used to mark a bubble as the user's own. XMTP callers pass
   *  `metro://xmtp/user/<inboxId>`. */
  myUri: string;
  /** Resolved eth address of the sender — used for the left-side stamp.fyi
   *  avatar. null when the SDK hasn't surfaced the mapping yet (we fall back
   *  to a tinted placeholder so row geometry doesn't shift). */
  senderEthAddress?: string | null;
  /** Tap on the avatar — parent routes to the per-user profile view. Skipped
   *  when undefined (e.g. legacy callers that don't wire it). */
  onAvatarPress?: (address: string) => void;
}): React.ReactElement {
  /** Discord-style layout doesn't visually distinguish own messages —
   *  myUri is accepted for forward compatibility (e.g. read-receipts) but
   *  not currently styled-on. Silence the no-unused-vars rule by void-ing
   *  the comparison. */
  void (entry.from === myUri);
  const atts = attachmentsOf(entry);
  const question = questionOf(entry);
  /** Group system events (rename / member add / image change) get a muted
   *  italic treatment and a feed color in the body text — set when
   *  envelopeOfXmtpMessage stamps `payload.system: true`. */
  const isSystem = (entry.payload as { system?: boolean } | undefined)?.system === true;
  const fg = isSystem ? (dark ? '#9f9fa3' : '#57606a') : (dark ? '#ffffff' : '#000000');
  const sub = dark ? '#7a7a7e' : '#8a929d';
  const pillBg = dark ? '#282a2d' : '#e4e4e5';
  const avatarBg = dark ? '#282a2d' : '#e4e4e5';
  const [pickerOpen, setPickerOpen] = useState(false);
  const markdownProps = {
    markdownit: mdParser,
    onLinkPress: (url: string): boolean => { void Linking.openURL(url); return false; },
    /** Discord-style: all messages render with the same typography regardless of sender. */
    style: markdownStyles(fg, dark, false),
  };
  /** Swipe-to-reply (right→left, Telegram-style): claim once dx is left-leaning + dominates dy,
   *  drag the bubble with the finger up to ~80px, snap back on release, fire onReply if dx<=-60. */
  const swipeX = useRef(new Animated.Value(0)).current;
  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponderCapture: (_, g) => {
      const ax = Math.abs(g.dx), ay = Math.abs(g.dy);
      return g.dx < -10 && ax > ay * 1.5;
    },
    onPanResponderMove: (_, g) => {
      swipeX.setValue(Math.max(-80, Math.min(0, g.dx)));
    },
    onPanResponderRelease: (_, g) => {
      const triggered = g.dx <= -60;
      Animated.spring(swipeX, { toValue: 0, useNativeDriver: true, speed: 18, bounciness: 6 }).start();
      if (triggered) onReply?.();
    },
    onPanResponderTerminate: () => {
      Animated.spring(swipeX, { toValue: 0, useNativeDriver: true, speed: 18, bounciness: 6 }).start();
    },
    onPanResponderTerminationRequest: () => false,
  }), [onReply, swipeX]);
  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={{
        flexDirection: 'row', alignItems: 'flex-start',
        paddingHorizontal: 12, paddingVertical: 6, gap: 10,
        transform: [{ translateX: swipeX }],
        opacity: pending ? 0.5 : 1,
        /** Permalink/reply jump target: full-row lighter background (~10% toward
         *  white), spanning the whole width incl. the avatar gutter. */
        backgroundColor: replyTarget
          ? (dark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.05)')
          : (unread ? (dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)') : 'transparent'),
      }}
    >
      {/** Discord-style row avatar — `sm` (24px). Tapping it surfaces the
       *   sender's profile via the parent's `onAvatarPress` handler. */}
      {senderEthAddress ? (
        <Pressable onPress={() => onAvatarPress?.(senderEthAddress)} hitSlop={6} style={{ marginTop: 2 }}>
          <Avatar
            address={senderEthAddress}
            size="sm"
            cacheBuster={getPeerAvatarCb(senderEthAddress)}
            style={{ backgroundColor: avatarBg }}
          />
        </Pressable>
      ) : (
        <Avatar size="sm" style={{ backgroundColor: avatarBg, marginTop: 2 }} />
      )}
      {/** Right column: message content + reactions + reaction picker stacked. */}
      <View style={{ flex: 1, minWidth: 0, flexDirection: 'column' }}>
      {/** Pressable handles onLongPress; the outer Animated.View'​s PanResponder steals horizontal drags. */}
      <Pressable
        onLongPress={onLongPress}
        delayLongPress={300}
        style={{
          flexDirection: 'column',
          /** Reply-target highlight is a full-row background on the outer View now;
           *  keep only the unread outline here. */
          borderWidth: unread ? 1.5 : 0,
          borderColor: unread ? (dark ? '#ffffff' : '#000000') : 'transparent',
        }}
      >
        {replyPreview ? (
          <Pressable
            onPress={onReplyPreviewPress}
            disabled={!onReplyPreviewPress}
            style={({ pressed }) => ({
              alignSelf: 'stretch', borderLeftWidth: 2, borderLeftColor: sub,
              paddingLeft: 6, marginBottom: 4, opacity: pressed ? 0.45 : 0.7,
            })}
          >
            <Text style={{ color: fg, fontSize: 14, fontStyle: 'italic' , fontFamily: 'Calibre-Medium'}} numberOfLines={2}>
              {replyPreview}
            </Text>
          </Pressable>
        ) : null}
        {atts.length > 0 ? <View style={{ alignSelf: 'stretch' }}>{atts.map((a, i) => {
          /** XMTP inline attachments carry bytes in `dataB64` — render via data: URI.
           *  Optimistic (pending) attachments carry the local `file://` URI so the
           *  image shows instantly while the send is in flight; full `http(s)`/
           *  `data:` URIs render as-is. The legacy daemon-hosted attachment path
           *  (`daemonUrl + token`) is gone since Metro is XMTP-only now. */
          const key = a.id ?? `${entry.id}-att-${i}`;
          /** Multi-remote attachments carry encrypted bytes on IPFS — resolve
           *  (download + decrypt) lazily before rendering. */
          if (a.remote) {
            return <RemoteAttachmentResolver key={key} att={a} fg={fg} sub={sub} dark={dark} />;
          }
          const fullUrl = a.dataB64
            ? `data:${a.mime ?? 'application/octet-stream'};base64,${a.dataB64}`
            : a.url ?? '';
          return (
            <AttachmentView
              key={key}
              att={a}
              fg={fg}
              sub={sub}
              fullUrl={fullUrl}
              dark={dark}
            />
          );
        })}</View> : null}
        {/** Markdown wrapped so the lib's internal layout can't bleed into the timestamp row below. */}
        {entry.text ? (
          <View style={{ alignSelf: 'stretch' }}>
            <Markdown {...markdownProps}>{entry.text}</Markdown>
          </View>
        ) : null}
        {/** Inline embeds — YouTube + location. Rendered below the message
         *   text so the source URL stays clickable while the preview gives
         *   the at-a-glance affordance. Detection is pure regex; misses
         *   gracefully render nothing. */}
        {(() => {
          const ytId = youtubeIdOf(entry.text);
          if (ytId) return <View style={{ alignSelf: 'stretch', marginTop: 6 }}><YouTubeEmbed videoId={ytId} dark={dark} /></View>;
          const coords = mapCoordsOf(entry.text);
          if (coords) return <View style={{ alignSelf: 'stretch', marginTop: 6 }}><LocationEmbed lat={coords.lat} lng={coords.lng} sourceUrl={coords.sourceUrl} dark={dark} /></View>;
          return null;
        })()}
        {question && onAnswer ? (
          <QuestionView question={question} dark={dark} sub={sub} onAnswer={onAnswer} />
        ) : null}
        {transcript ? (
          <Text style={{
            color: sub, opacity: 0.85, fontSize: 13, fontStyle: 'italic',
            marginTop: atts.length ? 4 : 0,
          }}>“{transcript}”</Text>
        ) : atts.some(a => a.kind === 'audio') && Date.now() - new Date(entry.ts).getTime() < 30_000 ? (
          /** Fresh audio bubble + transcription still running. Old audio without a transcript
           *  (predates the pipeline or its event was dropped) gets nothing rather than
           *  a forever "transcribing…" placeholder. */
          <Text style={{ color: sub, opacity: 0.6, fontSize: 13, fontStyle: 'italic', marginTop: 4 , fontFamily: 'Calibre-Medium'}}>
            transcribing…
          </Text>
        ) : null}
        <View style={{
          alignSelf: 'stretch',
          flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start',
          gap: 6, marginTop: 3,
        }}>
          {onReact ? (
            <Pressable onPress={() => setPickerOpen(o => !o)} hitSlop={8}>
              <HeroIcon name="faceSmile" size={14} color={sub} />
            </Pressable>
          ) : null}
          {onReply ? (
            <Pressable onPress={onReply} hitSlop={8}>
              <HeroIcon name="reply" size={14} color={sub} />
            </Pressable>
          ) : null}
          <Text style={{ color: sub, fontSize: 10 , fontFamily: 'Calibre-Medium'}}>{fmtTs(entry.ts)}</Text>
        </View>
      </Pressable>
      {reactions && reactions.size > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
          {[...reactions.entries()].map(([emoji, count]) => (
            <View key={emoji} style={{
              flexDirection: 'row', alignItems: 'center', gap: 4,
              paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: pillBg,
            }}>
              <Text style={{ fontSize: 13 , fontFamily: 'Calibre-Medium'}}>{emoji}</Text>
              <Text style={{ fontSize: 11, color: sub , fontFamily: 'Calibre-Medium'}}>{count}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {pickerOpen ? (
        <View style={{
          flexDirection: 'row', gap: 8, marginTop: 6, paddingHorizontal: 10, paddingVertical: 6,
          borderRadius: 999, backgroundColor: dark ? '#282a2d' : '#ffffff',
          shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, elevation: 4,
          alignSelf: 'flex-start',
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
    </Animated.View>
  );
}
