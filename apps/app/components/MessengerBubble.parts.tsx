/** Sub-row components for MessengerBubble — @mention chips/body + question view.
 *  Extracted to keep the bubble file under the phase-2 lint cap. */

import { useState } from 'react';
import { fontSize } from '@metro-labs/kit/tokens';
import { Pressable } from '@metro-labs/kit/pressable';
import { Textarea } from '@metro-labs/kit/textarea';
import { Text } from '@metro-labs/kit/text';
import { useRouter } from 'expo-router';
import { Box } from './layout';
import { shortAddress } from '../modules/messaging';
import { useProfileQuery } from '../lib/useProfile';
import { MENTION_RE } from './MessengerBubble.helpers';
import type { Question } from './MessengerBubble.helpers';
import { usePalette } from '../lib/theme';

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
    <Text weight="semibold"
      onPress={() => router.push({ pathname: '/user/[address]', params: { address } })} color={linkColor}
      suppressHighlighting>
      @{display}
    </Text>
  );
}

/** Body text with clickable `@0x<address>` mentions. Splits the raw text into
 *  alternating plain-text runs and mention runs, rendering plain runs with the
 *  bubble's existing markdown body typography (color/size/font) and each mention
 *  as a nested `<MentionLink>`. No-mention messages take a fast path upstream
 *  (the caller renders <Markdown> directly), so this only runs when at least one
 *  address mention is present (markdown isn't applied to those messages). */
export function MentionBody({ text, fg, dark, selectable }: { text: string; fg: string; dark: boolean; selectable?: boolean }): React.ReactElement {
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
    <Text size="3xl" selectable={selectable} color={fg} style={{ lineHeight: 23 }}>
      {runs}
    </Text>
  );
}

/** Question view — single-select fires onAnswer instantly; multi-select toggles
 *  options locally and submits the joined labels as one message on tap of "Submit".
 *  An implicit "Other…" affordance (default on) lets the user type a free-text
 *  answer instead of (or alongside, in multi mode) the listed options. */
export function QuestionView({ question, dark, sub, onAnswer }: {
  question: Question; dark: boolean; sub: string; onAnswer: (label: string) => void;
}): React.ReactElement {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [otherOpen, setOtherOpen] = useState(false);
  const [otherText, setOtherText] = useState('');
  const fg = usePalette().text; // #9f9fa3 / #57606a
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
    <Box gap={6} mt={8} style={{ alignSelf: 'stretch' }}>
      {question.header ? (
        <Text weight="semibold" size="3xs" color={sub} style={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
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
            <Text size="md" color={fg}>
              {multi ? (isOn ? '☑︎  ' : '☐  ') : ''}{opt.label}
            </Text>
            {opt.description ? (
              <Text size="2xs" color={sub} style={{ marginTop: 2 }}>
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
          <Text size="md" color={sub}>
            Other…
          </Text>
        </Pressable>
      ) : null}
      {otherOpen ? (
        <Box px={12} py={8} style={{ borderRadius: 12, backgroundColor: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)', borderWidth: 1, borderColor: dark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.14)' }}>
          <Textarea
            value={otherText}
            onChangeText={setOtherText}
            placeholder="Type your answer…"
            placeholderTextColor={sub}
            autoFocus
            dark={dark}
            inputProps={{ onSubmitEditing: submit, blurOnSubmit: true }}
            style={{
              color: fg,
              fontFamily: 'Calibre-Medium', fontSize: fontSize('md'), lineHeight: 22,
              minHeight: 22, padding: 0, backgroundColor: 'transparent', borderWidth: 0, height: undefined,
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
          <Text weight="semibold" size="sm" color={'#000'}>
            Submit{multi && selected.size > 0 ? ` (${selected.size}${otherText.trim() ? '+1' : ''})` : ''}
          </Text>
        </Pressable>
      ) : null}
    </Box>
  );
}
