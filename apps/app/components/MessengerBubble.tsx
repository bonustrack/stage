/** Discord-style messenger row: every message left-aligned, avatar at the start,
 *  no colored bubble even for the local user's own messages. */

import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, TextInput, View } from 'react-native';
import { Text } from '@metro-labs/kit/text';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, runOnJS } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { getPeerAvatarCb } from '../lib/peerProfiles';
import Markdown, { MarkdownIt } from 'react-native-markdown-display';
import { Icon } from '@metro-labs/kit/icon';
import { MessengerAudioPlayer } from './MessengerAudioPlayer';
import { MessengerImageAttachment } from './MessengerImageAttachment';
import { YouTubeEmbed, LocationEmbed } from './MediaEmbeds';
import { mapCoordsOf, youtubeIdOf } from '../lib/embedDetect';
import { Avatar } from './Avatar';
import { Row, Col, Box } from './layout';
import { Button } from '@metro-labs/kit/button';
import { resolveRemoteAttachment, shortAddress } from '../lib/xmtp';
import { useProfileQuery } from '../lib/useProfile';
import type { HistoryEntry } from '../lib/types';
import type { RemoteAttachmentInfo } from '@xmtp/react-native-sdk';

export const REACT_PRESETS = ['👍', '🔥', '👀', '🙏', '😁', '💯', '🫡'];
/** `linkify` + `breaks` turn bare URLs into tappable links and treat `\n` as a line
 *  break, matching the markdown-it config on the web side. Constructed once at
 *  module scope — the lib re-parses input each render anyway. */
const mdParser = MarkdownIt({ typographer: false, linkify: true, breaks: true });

/** Matches an `@`-mention stored in the raw message as a bare lowercase address
 *  (the composer's wire form), e.g. `@0x1d8c…0b5b`. Capture group 1 is the
 *  42-char address. The `\b` boundary lets a mention be immediately followed by
 *  punctuation (`@0xabc…, hi`) without swallowing it. Address matching is
 *  case-insensitive so a hand-typed mixed-case address still links. */
const MENTION_RE = /@(0x[0-9a-fA-F]{40})\b/g;

/** One tappable `@username` chip resolved from an address. Lives as its own
 *  component so the `useProfileQuery` hook is called exactly once per mention
 *  (never inside a loop in the parent) — react-query dedupes/caches the lookup
 *  across every chip pointing at the same address. Falls back to the short
 *  address while the profile is loading or has no username. */
function MentionLink({ address, dark }: { address: string; dark: boolean }): React.ReactElement {
  const router = useRouter();
  const { data: profile } = useProfileQuery(address);
  const display = profile?.name?.trim() || shortAddress(address);
  const linkColor = dark ? '#7aa2ff' : '#2f6feb';
  return (
    <Text
      onPress={() => router.push({ pathname: '/user/[address]', params: { address } })}
      style={{ color: linkColor, fontFamily: 'Calibre-Semibold' }}
      suppressHighlighting
    >
      @{display}
    </Text>
  );
}

/** Body text with clickable `@0x<address>` mentions. Splits the raw text into
 *  alternating plain-text runs and mention runs, rendering plain runs with the
 *  bubble's existing markdown body typography (color/size/font) and each mention
 *  as a nested `<MentionLink>`. No-mention messages take a fast path upstream
 *  (the caller renders <Markdown> directly), so this only runs when at least one
 *  address mention is present and markdown formatting is intentionally not
 *  applied to those messages. */
function MentionBody({ text, fg, dark }: { text: string; fg: string; dark: boolean }): React.ReactElement {
  const runs: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  MENTION_RE.lastIndex = 0;
  let i = 0;
  while ((m = MENTION_RE.exec(text)) !== null) {
    if (m.index > last) runs.push(text.slice(last, m.index));
    runs.push(<MentionLink key={`m${i}`} address={m[1].toLowerCase()} dark={dark} />);
    last = m.index + m[0].length;
    i += 1;
  }
  if (last < text.length) runs.push(text.slice(last));
  return (
    <Text style={{ color: fg, fontSize: 18, lineHeight: 23, fontFamily: 'Calibre-Medium' }}>
      {runs}
    </Text>
  );
}

/** Cheap test for the slow (mention-aware) body path. Resets the shared regex's
 *  `lastIndex` (the `g` flag makes `.test()` stateful) so a no-match leaves it at
 *  0 for the next caller. */
function hasMention(text: string): boolean {
  if (!text.includes('@0x')) return false;
  MENTION_RE.lastIndex = 0;
  const found = MENTION_RE.test(text);
  MENTION_RE.lastIndex = 0;
  return found;
}

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
      <Icon name="paperClip" size={16} color={fg} />
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
        <Icon name="paperClip" size={16} color={fg} />
        <Text style={{ color: fg, fontSize: 13, flexShrink: 1, fontFamily: 'Calibre-Medium' }} numberOfLines={1}>
          {att.name ?? 'attachment'} — tap to retry
        </Text>
      </Pressable>
    );
  }
  if (!uri) {
    return (
      <Row align="center" gap={8} px={10} py={8} radius={8} bg="rgba(0,0,0,0.12)" mb={6}>
        <ActivityIndicator size="small" color={fg} />
        <Text style={{ color: sub, fontSize: 13, fontFamily: 'Calibre-Medium' }} numberOfLines={1}>
          {att.name ?? 'attachment'}
        </Text>
      </Row>
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
    <Box style={{ alignSelf: 'stretch', gap: 6, marginTop: 8 }}>
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
        <Box style={{
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
        </Box>
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
    </Box>
  );
}

interface PollOption { label: string; description?: string }
interface Poll {
  pollId?: string;
  question?: string;
  header?: string;
  options: PollOption[];
  multiSelect?: boolean;
}

function pollOf(entry: HistoryEntry): Poll | undefined {
  const p = entry.payload as { poll?: Poll } | undefined;
  if (!p?.poll || !Array.isArray(p.poll.options)) return undefined;
  return p.poll;
}

/** PollView — clone of QuestionView, minus the Other / free-text affordance,
 *  plus live per-option vote counts, a filled result bar, and a checkmark on the
 *  options the local user has selected (`ownVotes`). Tapping an option fires
 *  `onVote(index, action)`; single-select tapping the option you already own
 *  retracts it (action:'removed'), tapping a different option casts the new one
 *  (the tally treats the latest 'added' as authoritative). Multi-select toggles
 *  each option independently. */
function PollView({ poll, dark, sub, votes, ownVotes, onVote }: {
  poll: Poll; dark: boolean; sub: string;
  votes?: Map<number, Set<string>>;
  ownVotes?: Set<number>;
  onVote: (optionIndex: number, action: 'added' | 'removed') => void;
}): React.ReactElement {
  const multi = poll.multiSelect === true;
  const total = poll.options.reduce((n, _o, i) => n + (votes?.get(i)?.size ?? 0), 0);
  const tap = (idx: number): void => {
    const owned = ownVotes?.has(idx) ?? false;
    onVote(idx, owned ? 'removed' : 'added');
  };
  return (
    <Box style={{ alignSelf: 'stretch', gap: 6, marginTop: 8 }}>
      {poll.header ? (
        <Text style={{ color: sub, fontSize: 11, fontFamily: 'Calibre-Semibold', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {poll.header}{multi ? ' · multi-select' : ''}
        </Text>
      ) : null}
      {poll.options.map((opt, i) => {
        const count = votes?.get(i)?.size ?? 0;
        const isOn = ownVotes?.has(i) ?? false;
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        return (
          <Pressable
            key={`${i}-${opt.label}`}
            onPress={() => tap(i)}
            style={({ pressed }) => ({
              paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12,
              overflow: 'hidden',
              backgroundColor: isOn
                ? (dark ? 'rgba(192,160,110,0.22)' : 'rgba(192,160,110,0.18)')
                : pressed
                  ? (dark ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.08)')
                  : (dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)'),
              borderWidth: 1,
              borderColor: isOn ? '#c0a06e' : (dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)'),
            })}
          >
            {/** Result bar — width tracks the option's vote share, sits behind the label. */}
            <Box
              pointerEvents="none"
              style={{
                position: 'absolute', left: 0, top: 0, bottom: 0,
                width: `${pct}%`,
                backgroundColor: dark ? 'rgba(192,160,110,0.16)' : 'rgba(192,160,110,0.14)',
              }}
            />
            <Row align="center" justify="between">
              <Text style={{ color: dark ? '#9f9fa3' : '#57606a', fontSize: 15, fontFamily: 'Calibre-Medium', flexShrink: 1 }}>
                {isOn ? '✓  ' : (multi ? '☐  ' : '')}{opt.label}
              </Text>
              <Text style={{ color: sub, fontSize: 13, fontFamily: 'Calibre-Semibold', marginLeft: 8 }}>
                {count}
              </Text>
            </Row>
            {opt.description ? (
              <Text style={{ color: sub, fontSize: 12, fontFamily: 'Calibre-Medium', marginTop: 2 }}>
                {opt.description}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
      <Text style={{ color: sub, fontSize: 11, fontFamily: 'Calibre-Medium', marginTop: 2 }}>
        {total} vote{total === 1 ? '' : 's'}
      </Text>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// In-chat signatures — SignatureRequest (request to sign) + SignatureReference
// (the signature posted back). Local-render shapes mirror
// @metro-labs/client/xmtp/sign.
// ---------------------------------------------------------------------------

interface SigRequest {
  id?: string;
  kind?: 'eip712' | 'personal';
  eip712?: { domain?: Record<string, unknown>; types?: Record<string, Array<{ name: string; type: string }>>; primaryType?: string; message?: Record<string, unknown> };
  message?: string;
  description?: string;
}
interface SigReference {
  requestId?: string;
  signature: string;
  signer?: string;
}

function sigRequestOf(entry: HistoryEntry): SigRequest | undefined {
  const p = entry.payload as { signatureRequest?: SigRequest } | undefined;
  if (!p?.signatureRequest?.kind) return undefined;
  return p.signatureRequest;
}
function sigReferenceOf(entry: HistoryEntry): SigReference | undefined {
  const p = entry.payload as { signatureReference?: SigReference } | undefined;
  if (!p?.signatureReference?.signature) return undefined;
  return p.signatureReference;
}

/** Render one EIP-712 message value as a readable string. Scalars pass through
 *  (addresses/hex shown as-is, long hex truncated); nested objects/arrays are
 *  JSON-stringified compactly so a row stays one line-ish. */
function fmtSigValue(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') {
    // Truncate very long hex (calldata, byte blobs) but keep addresses intact.
    if (/^0x[0-9a-fA-F]{42,}$/.test(v) && v.length > 24) return `${v.slice(0, 12)}…${v.slice(-8)}`;
    return v;
  }
  if (typeof v === 'number' || typeof v === 'bigint' || typeof v === 'boolean') return String(v);
  try {
    const s = JSON.stringify(v);
    return s.length > 200 ? `${s.slice(0, 197)}…` : s;
  } catch { return String(v); }
}

/** SigRequestCard — a signature-request bubble. Shows the description plus the
 *  full message detail (domain/primaryType/fields for eip712, raw text for
 *  personal) so the signer can review before tapping "Sign". */
function SigRequestCard({ req, dark, sub, signing, onSign }: {
  req: SigRequest; dark: boolean; sub: string; signing?: boolean;
  onSign?: () => void;
}): React.ReactElement {
  const desc = req.description?.trim()
    || (req.kind === 'eip712' ? `Sign ${req.eip712?.primaryType ?? 'typed data'}` : 'Sign message');
  const detailBg = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
  const detailBorder = dark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)';
  const head = dark ? '#ffffff' : '#000000';

  const domain = req.eip712?.domain as { name?: unknown; chainId?: unknown } | undefined;
  const domainName = domain?.name != null ? String(domain.name) : undefined;
  const chainId = domain?.chainId != null ? String(domain.chainId) : undefined;
  const fields = req.kind === 'eip712' && req.eip712?.message
    ? Object.entries(req.eip712.message)
    : [];

  return (
    <Box style={{
      alignSelf: 'stretch', gap: 8, marginTop: 8, padding: 12, borderRadius: 14,
      backgroundColor: dark ? '#282a2d' : '#e4e4e5',
    }}>
      <Row align="center" gap={8}>
        <Icon name="pencil" size={18} color={head} />
        <Text style={{ color: head, fontSize: 15, fontFamily: 'Calibre-Semibold', flexShrink: 1 }}>
          {desc}
        </Text>
      </Row>

      {req.kind === 'eip712' ? (
        <Col gap={6} style={{
          padding: 10, borderRadius: 10, borderWidth: 1,
          borderColor: detailBorder, backgroundColor: detailBg,
        }}>
          {(domainName || chainId) ? (
            <Text style={{ color: sub, fontSize: 12, fontFamily: 'Calibre-Medium' }}>
              {domainName ?? 'Domain'}{chainId ? ` · chain ${chainId}` : ''}
            </Text>
          ) : null}
          {req.eip712?.primaryType ? (
            <Text style={{ color: head, fontSize: 13, fontFamily: 'Calibre-Semibold' }}>
              {req.eip712.primaryType}
            </Text>
          ) : null}
          {fields.map(([k, v]) => (
            <Row key={k} align="start" gap={8}>
              <Text style={{ color: sub, fontSize: 12, fontFamily: 'Calibre-Medium', minWidth: 80, flexShrink: 0 }}>
                {k}
              </Text>
              <Text numberOfLines={4} style={{ color: head, fontSize: 12, fontFamily: 'Menlo', flexShrink: 1, flex: 1 }}>
                {fmtSigValue(v)}
              </Text>
            </Row>
          ))}
        </Col>
      ) : req.message ? (
        <Box style={{
          padding: 10, borderRadius: 10, borderWidth: 1,
          borderColor: detailBorder, backgroundColor: detailBg,
        }}>
          <Text numberOfLines={20} style={{ color: head, fontSize: 12, fontFamily: 'Menlo', lineHeight: 18 }}>
            {req.message}
          </Text>
        </Box>
      ) : null}

      {onSign ? (
        <Button
          variant="primary"
          size="lg"
          fullWidth
          pill
          dark={dark}
          loading={signing}
          onPress={onSign}
          label="Sign"
          style={{ marginTop: 2 }}
        />
      ) : null}
    </Box>
  );
}

/** SigReferenceCard — a completed signature. Shows "Signed ✓" + the signer and
 *  a shortened signature. */
function SigReferenceCard({ ref, dark, sub }: {
  ref: SigReference; dark: boolean; sub: string;
}): React.ReactElement {
  const short = (h?: string): string => (h && h.length > 14 ? `${h.slice(0, 8)}…${h.slice(-4)}` : (h ?? ''));
  return (
    <Box style={{
      alignSelf: 'stretch', gap: 6, marginTop: 8, padding: 12, borderRadius: 14,
      borderWidth: 1, borderColor: dark ? 'rgba(120,200,120,0.4)' : 'rgba(60,160,60,0.35)',
      backgroundColor: dark ? 'rgba(120,200,120,0.08)' : 'rgba(60,160,60,0.06)',
    }}>
      <Row align="center" gap={8}>
        <Icon name="check" size={18} color={dark ? '#7fd07f' : '#2f9e44'} />
        <Text style={{ color: dark ? '#ffffff' : '#000000', fontSize: 15, fontFamily: 'Calibre-Semibold' }}>
          Signed ✓
        </Text>
      </Row>
      {ref.signer ? (
        <Text style={{ color: sub, fontSize: 12, fontFamily: 'Calibre-Medium' }}>
          by {shortAddress(ref.signer)}
        </Text>
      ) : null}
      <Text style={{ color: '#c0a06e', fontSize: 13, fontFamily: 'Calibre-Medium' }}>
        {short(ref.signature)}
      </Text>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// In-chat transactions — WalletSendCalls (request) + TransactionReference
// (receipt). Local-render shapes mirror @metro-labs/client/xmtp/tx.
// ---------------------------------------------------------------------------

interface TxRequest {
  version?: string;
  chainId?: string;
  from?: string;
  calls: Array<{ to?: string; data?: string; value?: string; metadata?: { description?: string; currency?: string; amount?: number } }>;
}
interface TxReceipt {
  networkId: number | string;
  reference: string;
  metadata?: { currency?: string; amount?: number; toAddress?: string };
}

function txRequestOf(entry: HistoryEntry): TxRequest | undefined {
  const p = entry.payload as { walletSendCalls?: TxRequest } | undefined;
  if (!p?.walletSendCalls || !Array.isArray(p.walletSendCalls.calls)) return undefined;
  return p.walletSendCalls;
}
function txReceiptOf(entry: HistoryEntry): TxReceipt | undefined {
  const p = entry.payload as { txReference?: TxReceipt } | undefined;
  if (!p?.txReference?.reference) return undefined;
  return p.txReference;
}

/** Block-explorer URL for a chain id (decimal/hex/number) + tx hash. Mirrors
 *  explorerTxUrl in @metro-labs/client/xmtp/tx (re-stated to avoid pulling the
 *  helper through a separate import in the bubble). */
function explorerUrl(networkId: number | string, txHash: string): string {
  const id = typeof networkId === 'number' ? networkId
    : networkId.startsWith('0x') ? parseInt(networkId, 16) : parseInt(networkId, 10);
  const base: Record<number, string> = {
    1: 'https://etherscan.io', 10: 'https://optimistic.etherscan.io',
    137: 'https://polygonscan.com', 8453: 'https://basescan.org',
    42161: 'https://arbiscan.io', 11155111: 'https://sepolia.etherscan.io',
  };
  return `${base[id] ?? 'https://etherscan.io'}/tx/${txHash}`;
}

/** Format a hex-wei value (from a WalletSendCalls call) as a short ETH string. */
function ethFromWeiHex(valueHex?: string): string | undefined {
  if (!valueHex) return undefined;
  try {
    const wei = BigInt(valueHex);
    /** Trim to a readable decimal — 1e18 wei = 1 ETH. */
    const whole = wei / 1_000_000_000_000_000_000n;
    const frac = wei % 1_000_000_000_000_000_000n;
    if (frac === 0n) return `${whole}`;
    const fracStr = frac.toString().padStart(18, '0').replace(/0+$/, '');
    return `${whole}.${fracStr}`;
  } catch { return undefined; }
}

/** TxRequestCard — a payment request bubble. Shows the description + amount and
 *  a "Pay" button that fires `onPay` (the parent broadcasts via the phase-3
 *  sendTx helper, then posts a TransactionReference back). */
function TxRequestCard({ req, dark, sub, paying, onPay }: {
  req: TxRequest; dark: boolean; sub: string; paying?: boolean;
  onPay?: () => void;
}): React.ReactElement {
  const call = req.calls[0];
  const desc = call?.metadata?.description ?? 'Payment request';
  const eth = ethFromWeiHex(call?.value);
  const amountLabel = call?.metadata?.amount != null
    ? `${call.metadata.amount} ${call.metadata.currency ?? 'ETH'}`
    : eth ? `${eth} ETH` : undefined;
  return (
    <View style={{
      alignSelf: 'stretch', gap: 8, marginTop: 8, padding: 12, borderRadius: 14,
      borderWidth: 1, borderColor: '#c0a06e',
      backgroundColor: dark ? 'rgba(192,160,110,0.10)' : 'rgba(192,160,110,0.10)',
    }}>
      <Row align="center" gap={8}>
        <Icon name="wallet" size={18} color="#c0a06e" />
        <Text style={{ color: dark ? '#ffffff' : '#000000', fontSize: 15, fontFamily: 'Calibre-Semibold', flexShrink: 1 }}>
          {desc}
        </Text>
      </Row>
      {amountLabel ? (
        <Text style={{ color: dark ? '#ffffff' : '#000000', fontSize: 22, fontFamily: 'Calibre-Semibold' }}>
          {amountLabel}
        </Text>
      ) : null}
      {call?.to ? (
        <Text style={{ color: sub, fontSize: 12, fontFamily: 'Calibre-Medium' }}>
          To {shortAddress(call.to)}
        </Text>
      ) : null}
      {onPay ? (
        <Button
          variant="primary"
          size="lg"
          fullWidth
          pill
          dark={dark}
          loading={paying}
          onPress={onPay}
          label="Pay"
          style={{ marginTop: 2 }}
        />
      ) : null}
    </View>
  );
}

/** TxReceiptCard — a confirmed payment. Shows the amount (when the metadata
 *  carried it) and a tappable explorer link to the tx hash. */
function TxReceiptCard({ receipt, dark, sub }: {
  receipt: TxReceipt; dark: boolean; sub: string;
}): React.ReactElement {
  const amountLabel = receipt.metadata?.amount != null
    ? `${receipt.metadata.amount} ${receipt.metadata.currency ?? 'ETH'}`
    : undefined;
  const url = explorerUrl(receipt.networkId, receipt.reference);
  return (
    <View style={{
      alignSelf: 'stretch', gap: 6, marginTop: 8, padding: 12, borderRadius: 14,
      borderWidth: 1, borderColor: dark ? 'rgba(120,200,120,0.4)' : 'rgba(60,160,60,0.35)',
      backgroundColor: dark ? 'rgba(120,200,120,0.08)' : 'rgba(60,160,60,0.06)',
    }}>
      <Row align="center" gap={8}>
        <Icon name="check" size={18} color={dark ? '#7fd07f' : '#2f9e44'} />
        <Text style={{ color: dark ? '#ffffff' : '#000000', fontSize: 15, fontFamily: 'Calibre-Semibold' }}>
          Payment sent{amountLabel ? ` · ${amountLabel}` : ''}
        </Text>
      </Row>
      <Pressable onPress={() => void Linking.openURL(url)}>
        <Text style={{ color: '#c0a06e', fontSize: 13, fontFamily: 'Calibre-Medium' }}>
          {shortAddress(receipt.reference)} · View on explorer
        </Text>
      </Pressable>
    </View>
  );
}

function MessengerBubbleBase({
  entry, dark, unread, pending, replyTarget, onReact, onReply, onLongPress, onOpenMenu, onAnswer,
  replyPreview, onReplyPreviewPress, reactions, pendingReactions, pendingRemovals, ownEmojis, transcript, myUri, senderEthAddress, onAvatarPress,
  votes, ownVotes, onVote, onPay, paying, onSign, signing,
}: {
  entry: HistoryEntry; dark: boolean; unread: boolean; pending?: boolean; replyTarget?: boolean;
  onReact?: (emoji: string) => void; onReply?: () => void; onLongPress?: () => void;
  /** Single-tap a message → open the Telegram-style anchored menu. The parent
   *  positions the emoji-strip + action-dropdown overlay relative to the row's
   *  on-screen rect (measured here via measureInWindow). */
  onOpenMenu?: (anchor: { y: number; height: number }) => void;
  /** Tap the quoted reply-preview slab → parent jumps/scrolls to the original
   *  message. No-op when undefined (e.g. a bubble that isn't a reply). */
  onReplyPreviewPress?: () => void;
  /** Tapping a question option fires this with the chosen label (parent sends it as
   *  a normal user message with replyTo=entry.id so the agent links the answer to
   *  the question). */
  onAnswer?: (label: string) => void;
  replyPreview?: string; reactions?: Map<string, number>;
  /** Optimistic (not-yet-confirmed) reactions from the local user — rendered at
   *  reduced opacity alongside confirmed reaction pills until the live XMTP
   *  stream echoes them back. */
  pendingReactions?: string[];
  /** Emojis the local user just un-reacted (optimistic) — hide the confirmed pill
   *  immediately until the live stream echoes the `removed` event. */
  pendingRemovals?: string[];
  /** Emojis the local user currently owns on this message — own pills get a subtle
   *  outline + tapping/long-pressing one toggles the reaction off (onReact). */
  ownEmojis?: Set<string>;
  transcript?: string;
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
  /** Poll tally: option index → set of voter URIs. Drives the per-option count
   *  + result bar. Undefined for non-poll bubbles. */
  votes?: Map<number, Set<string>>;
  /** Option indices the local user currently has selected on this poll. */
  ownVotes?: Set<number>;
  /** Cast/retract a vote on this poll's option. */
  onVote?: (optionIndex: number, action: 'added' | 'removed') => void;
  /** Pay an in-chat payment request (WalletSendCalls). The parent broadcasts the
   *  call via the phase-3 sendTx helper and posts a TransactionReference back.
   *  Undefined => the Pay button is hidden (e.g. it's the user's own request). */
  onPay?: () => void;
  /** True while this request's payment is broadcasting — shows a spinner on Pay. */
  paying?: boolean;
  /** Sign an in-chat signature request. The parent signs via wagmi
   *  (signTypedData / signMessage) and posts a SignatureReference back. */
  onSign?: () => void;
  /** True while this request's signature is being produced — shows a spinner. */
  signing?: boolean;
}): React.ReactElement {
  /** Discord-style layout doesn't visually distinguish own messages —
   *  myUri is accepted for forward compatibility (e.g. read-receipts) but
   *  not currently styled-on. Silence the no-unused-vars rule by void-ing
   *  the comparison. */
  void (entry.from === myUri);
  const atts = attachmentsOf(entry);
  const question = questionOf(entry);
  const poll = pollOf(entry);
  const sigReq = sigRequestOf(entry);
  const sigRef = sigReferenceOf(entry);
  const txReq = txRequestOf(entry);
  const txReceipt = txReceiptOf(entry);
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
  /** Swipe-to-reply (right→left, Telegram-style), now on react-native-gesture-handler
   *  (was a legacy RN PanResponder). PanResponder sat OUTSIDE RNGH's arbitration, so
   *  it couldn't coordinate with the RNGH-based back gesture or yield cleanly to the
   *  FlatList scroll — moving it onto an RNGH `Gesture.Pan()` lets RNGH arbitrate all
   *  three by direction:
   *    - reply  = LEFTWARD  horizontal  → `.activeOffsetX(-15)` (arms only on a clear
   *               leftward drag; a rightward back-swipe never arms it).
   *    - scroll = VERTICAL              → `.failOffsetY([-12,12])` (a vertical-first
   *               drag fails this gesture, handing the touch to the inverted FlatList).
   *    - back   = RIGHTWARD             → opposite sign, never claimed here.
   *  The bubble translateX tracks the finger (clamped to [-80,0]) on the UI thread via
   *  reanimated; on release past ~60px it fires onReply, then springs back. */
  const swipeX = useSharedValue(0);
  const fireReply = (): void => { if (!pending) onReply?.(); };
  const replyPan = useMemo(() => Gesture.Pan()
    .activeOffsetX(-15)
    .failOffsetY([-12, 12])
    .onChange(e => {
      swipeX.value = Math.max(-80, Math.min(0, e.translationX));
    })
    .onEnd(e => {
      if (e.translationX <= -60) runOnJS(fireReply)();
      swipeX.value = withSpring(0, { damping: 18, stiffness: 220 });
    })
    .onFinalize(() => {
      swipeX.value = withSpring(0, { damping: 18, stiffness: 220 });
    }),
    // fireReply closes over onReply+pending; recreate when they change.
    [onReply, pending, swipeX]);
  const swipeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: swipeX.value }] }));
  /** Tap a message → discriminate single vs double:
   *   - SINGLE tap (no second tap within 230ms) → open the Telegram-style anchored
   *     menu (emoji strip + action dropdown). We measure the row's on-screen rect at
   *     tap time and hand the parent the Y + height so it can float the overlay just
   *     above/below the bubble.
   *   - DOUBLE tap (second tap inside the window) → quick 👍, reusing the same
   *     optimistic onReact toggle path as the emoji picker/pills (add if not present,
   *     remove if already your 👍). The pending single-tap is cancelled.
   *  The outer RNGH Pan gesture still owns horizontal swipe-to-reply, so taps and swipes
   *  don't collide. The ~230ms delay on the menu opening is the standard cost of
   *  double-tap support. */
  const rowRef = useRef<React.ComponentRef<typeof View>>(null);
  const singleTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Cached anchor from the tap's measureInWindow, so the delayed single-tap still
   *  floats the menu against the row's on-screen rect after the 230ms window. */
  const pendingAnchor = useRef<{ y: number; height: number }>({ y: 0, height: 0 });
  useEffect(() => () => {
    if (singleTapTimer.current) clearTimeout(singleTapTimer.current);
  }, []);
  const onBubbleTap = (): void => {
    if (pending) return;
    /** Second tap inside the window → double-tap quick 👍, cancel the pending single. */
    if (singleTapTimer.current) {
      clearTimeout(singleTapTimer.current);
      singleTapTimer.current = null;
      onReact?.('👍');
      return;
    }
    if (!onOpenMenu) return;
    /** Capture the anchor now (the row may have scrolled by the time the timer
     *  fires). measureInWindow is async, so stash the result in a ref. */
    const node = rowRef.current;
    if (node) node.measureInWindow((_x, y, _w, h) => { pendingAnchor.current = { y, height: h }; });
    else pendingAnchor.current = { y: 0, height: 0 };
    singleTapTimer.current = setTimeout(() => {
      singleTapTimer.current = null;
      onOpenMenu(pendingAnchor.current);
    }, 230);
  };
  /** Long-press → open the menu immediately (no tap-discrimination delay). Measures
   *  the row rect synchronously-ish via measureInWindow, same anchor contract. */
  const onBubbleLongPress = (): void => {
    if (pending) return;
    if (singleTapTimer.current) { clearTimeout(singleTapTimer.current); singleTapTimer.current = null; }
    if (!onOpenMenu) { onLongPress?.(); return; }
    const node = rowRef.current;
    if (!node) { onOpenMenu({ y: 0, height: 0 }); return; }
    node.measureInWindow((_x, y, _w, h) => onOpenMenu({ y, height: h }));
  };
  return (
    <GestureDetector gesture={replyPan}>
    <Animated.View
      ref={rowRef}
      style={[swipeStyle, {
        flexDirection: 'row', alignItems: 'flex-start',
        paddingHorizontal: 12, paddingVertical: 6, gap: 10,
        /** Permalink/reply jump target: full-row lighter background (~10% toward
         *  white), spanning the whole width incl. the avatar gutter. */
        backgroundColor: replyTarget
          ? (dark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.05)')
          : (unread ? (dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)') : 'transparent'),
      }]}
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
      <Col flex={1} style={{ minWidth: 0, opacity: pending ? 0.5 : 1 }}>
      {/** Pressable handles onLongPress; the outer RNGH Pan gesture claims leftward horizontal drags. */}
      <Pressable
        onPress={(onOpenMenu || onReact) ? onBubbleTap : undefined}
        onLongPress={pending ? undefined : (onOpenMenu ? onBubbleLongPress : onLongPress)}
        delayLongPress={300}
        style={{
          flexDirection: 'column',
          /** Reply-target highlight is a full-row background on the outer View now;
           *  keep only the unread outline here. */
          borderWidth: unread ? 1.5 : 0,
          borderColor: unread ? (dark ? '#ffffff' : '#000000') : 'transparent',
        }}
      >
        {/** Timestamp / "Sending" header — rendered ABOVE the message body
         *   (reply preview / attachments / text) as a small left-aligned
         *   header line. Same Text style as the old footer timestamp. */}
        <Row align="center" justify="start" style={{ alignSelf: 'stretch' }}>
          <Text style={{ color: sub, fontSize: 11 , fontFamily: 'Calibre-Medium'}}>{pending ? 'Sending' : fmtTs(entry.ts)}</Text>
        </Row>
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
        {atts.length > 0 ? <Box style={{ alignSelf: 'stretch' }}>{atts.map((a, i) => {
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
        })}</Box> : null}
        {/** Markdown wrapped so the lib's internal layout can't bleed into the timestamp row below. */}
        {poll ? (
          /** Poll bubble: render the question as the main text (the raw fallback
           *  multi-line string lives in entry.text but the PollView shows the
           *  options interactively, so we only surface the question here). */
          poll.question ? (
            <Box style={{ alignSelf: 'stretch' }}>
              <Markdown {...markdownProps}>{poll.question}</Markdown>
            </Box>
          ) : null
        ) : (txReq || txReceipt) ? (
          /** Transaction bubbles render an interactive card instead of the raw
           *  "[Transaction request]" / "[Transaction]" fallback text. */
          null
        ) : entry.text ? (
          <Box style={{ alignSelf: 'stretch' }}>
            {hasMention(entry.text)
              ? <MentionBody text={entry.text} fg={fg} dark={dark} />
              : <Markdown {...markdownProps}>{entry.text}</Markdown>}
          </Box>
        ) : null}
        {/** Inline embeds — YouTube + location. Rendered below the message
         *   text so the source URL stays clickable while the preview gives
         *   the at-a-glance affordance. Detection is pure regex; misses
         *   gracefully render nothing. */}
        {(() => {
          const ytId = youtubeIdOf(entry.text);
          if (ytId) return <Box style={{ alignSelf: 'stretch', marginTop: 6 }}><YouTubeEmbed videoId={ytId} dark={dark} /></Box>;
          const coords = mapCoordsOf(entry.text);
          if (coords) return <Box style={{ alignSelf: 'stretch', marginTop: 6 }}><LocationEmbed lat={coords.lat} lng={coords.lng} sourceUrl={coords.sourceUrl} dark={dark} /></Box>;
          return null;
        })()}
        {question && onAnswer ? (
          <QuestionView question={question} dark={dark} sub={sub} onAnswer={onAnswer} />
        ) : null}
        {poll && onVote ? (
          <PollView poll={poll} dark={dark} sub={sub} votes={votes} ownVotes={ownVotes} onVote={onVote} />
        ) : null}
        {sigReq ? (
          <SigRequestCard req={sigReq} dark={dark} sub={sub} signing={signing} onSign={onSign} />
        ) : null}
        {sigRef ? (
          <SigReferenceCard ref={sigRef} dark={dark} sub={sub} />
        ) : null}
        {txReq ? (
          <TxRequestCard req={txReq} dark={dark} sub={sub} paying={paying} onPay={onPay} />
        ) : null}
        {txReceipt ? (
          <TxReceiptCard receipt={txReceipt} dark={dark} sub={sub} />
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
        <Row align="center" justify="start" gap={6} mt={3} style={{ alignSelf: 'stretch' }}>
          {/** While pending: hide the react + reply affordances and show "Sending"
           *   in place of the timestamp, reusing the exact timestamp Text style. */}
          {!pending && onReact ? (
            <Pressable onPress={() => setPickerOpen(o => !o)} hitSlop={8}>
              <Icon name="faceSmile" size={14} color={sub} />
            </Pressable>
          ) : null}
          {!pending && onReply ? (
            <Pressable onPress={onReply} hitSlop={8}>
              <Icon name="reply" size={14} color={sub} />
            </Pressable>
          ) : null}
        </Row>
      </Pressable>
      {pending ? null : (() => {
        /** Only show a pending pill for an emoji the live stream hasn't yet
         *  confirmed on this message — once it lands in `reactions` the parent
         *  also drops it from the optimistic list, but this guards the in-between
         *  frame so we never render a confirmed + pending pill for the same emoji. */
        const pendingEmojis = (pendingReactions ?? []).filter(e => !reactions?.has(e));
        /** Drop optimistically-removed emojis from the confirmed pill list so the
         *  pill vanishes the instant the user un-reacts (before the stream echo). */
        const removed = new Set(pendingRemovals ?? []);
        const confirmedEntries = reactions
          ? [...reactions.entries()].filter(([emoji]) => !removed.has(emoji))
          : [];
        const hasConfirmed = confirmedEntries.length > 0;
        if (!hasConfirmed && pendingEmojis.length === 0) return null;
        return (
          <Row wrap gap={4} mt={4}>
            {confirmedEntries.map(([emoji, count]) => {
              /** Tapping/long-pressing ANY pill toggles that emoji as the user's
               *  own reaction — onReact handles add-if-not-owned / remove-if-owned.
               *  Own pills get a subtle outline to signal they're "mine". */
              const mine = !!ownEmojis?.has(emoji);
              const inner = (
                <>
                  <Text style={{ fontSize: 13, fontFamily: 'Calibre-Medium' }}>{emoji}</Text>
                  <Text style={{ fontSize: 11, color: sub, fontFamily: 'Calibre-Medium' }}>{count}</Text>
                </>
              );
              const pillStyle = {
                flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4,
                paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: pillBg,
                borderWidth: mine ? 1 : 0,
                borderColor: mine ? (dark ? '#7aa2ff' : '#2f6feb') : 'transparent',
              };
              return onReact ? (
                <Pressable
                  key={emoji}
                  onPress={() => onReact(emoji)}
                  onLongPress={() => onReact(emoji)}
                  delayLongPress={300}
                  hitSlop={6}
                  style={pillStyle}
                >
                  {inner}
                </Pressable>
              ) : (
                <Box key={emoji} style={pillStyle}>{inner}</Box>
              );
            })}
            {pendingEmojis.map(emoji => (
              <Row key={`pending-${emoji}`} align="center" gap={4} px={8} py={2} radius={999} bg={pillBg} style={{
                opacity: 0.45,
              }}>
                <Text style={{ fontSize: 13 , fontFamily: 'Calibre-Medium'}}>{emoji}</Text>
                <Text style={{ fontSize: 11, color: sub , fontFamily: 'Calibre-Medium'}}>1</Text>
              </Row>
            ))}
          </Row>
        );
      })()}
      {pickerOpen && !pending ? (
        <Row gap={8} mt={6} px={10} py={6} radius={999} bg={dark ? '#282a2d' : '#ffffff'} style={{
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
        </Row>
      ) : null}
      </Col>
    </Animated.View>
    </GestureDetector>
  );
}

/** #6: memoised so a single stream tick that re-renders the conversation
 *  feed only re-renders bubbles whose props changed, not the whole window. */
export const MessengerBubble = memo(MessengerBubbleBase);
