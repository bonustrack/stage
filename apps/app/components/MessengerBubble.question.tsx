/** @file QuestionView and its option/other/submit sub-rows for MessengerBubble. */
import { useState } from 'react';
import { fontSize } from '@metro-labs/kit/tokens';
import { Pressable } from '@metro-labs/kit/pressable';
import { Textarea } from '@metro-labs/kit/textarea';
import { Text } from '@metro-labs/kit/text';
import { Box } from './layout';
import type { Question } from './MessengerBubble.helpers';
import { usePalette } from '../lib/theme';

/** Local question-answering state (selection set + free-text "Other" field) and its actions. */
interface QuestionState {
  selected: Set<string>;
  otherOpen: boolean;
  otherText: string;
  multi: boolean;
  allowOther: boolean;
  setOtherOpen: (v: boolean) => void;
  setOtherText: (v: string) => void;
  toggle: (label: string) => void;
  submit: () => void;
}

/** Manage selection + free-text state and the toggle/submit actions for a question. */
function useQuestionState(question: Question, onAnswer: (label: string) => void): QuestionState {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [otherOpen, setOtherOpen] = useState(false);
  const [otherText, setOtherText] = useState('');
  const multi = question.multiSelect === true;
  const allowOther = question.allowOther !== false;
  /** Toggle helper. */
  const toggle = (label: string): void => {
    if (!multi) { onAnswer(label); return; }
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label); else next.add(label);
      return next;
    });
  };
  /** Submit helper. */
  const submit = (): void => {
    /** Preserve the user's option order so the answer reads naturally. */
    const chosen = question.options.filter(o => selected.has(o.label)).map(o => o.label);
    const other = otherText.trim();
    if (multi) {
      if (chosen.length === 0 && !other) return;
      onAnswer([...chosen, ...(other ? [other] : [])].join(', '));
      return;
    }
    /** Single-select Other submit — just send the typed text. */
    if (!other) return;
    onAnswer(other);
  };
  return { selected, otherOpen, otherText, multi, allowOther, setOtherOpen, setOtherText, toggle, submit };
}

/** Background color for an option button given its selected/pressed state. */
function optionBg(isOn: boolean, pressed: boolean, dark: boolean): string {
  if (isOn) return dark ? 'rgba(192,160,110,0.22)' : 'rgba(192,160,110,0.18)';
  if (pressed) return dark ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.08)';
  return dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)';
}

/** Renders one selectable question option row. */
function OptionRow({ opt, isOn, multi, dark, sub, fg, onPress }: {
  opt: Question['options'][number]; isOn: boolean; multi: boolean;
  dark: boolean; sub: string; fg: string; onPress: () => void;
}): React.ReactElement {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12,
        backgroundColor: optionBg(isOn, pressed, dark),
        borderWidth: 1,
        borderColor: isOn ? '#c0a06e' : (dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)'),
      })}
    >
      <Text size="md" color={fg}>{multi ? (isOn ? '☑︎  ' : '☐  ') : ''}{opt.label}</Text>
      {opt.description ? (
        <Text size="2xs" color={sub} style={{ marginTop: 2 }}>{opt.description}</Text>
      ) : null}
    </Pressable>
  );
}

/** Renders the dashed "Other…" affordance that opens the free-text field. */
function OtherToggle({ dark, sub, onPress }: { dark: boolean; sub: string; onPress: () => void }): React.ReactElement {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12,
        backgroundColor: pressed
          ? (dark ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.08)')
          : (dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)'),
        borderWidth: 1, borderStyle: 'dashed',
        borderColor: dark ? 'rgba(255,255,255,0.20)' : 'rgba(0,0,0,0.18)',
      })}
    >
      <Text size="md" color={sub}>Other…</Text>
    </Pressable>
  );
}

/** Renders the free-text "Other" answer textarea. */
function OtherField({ value, onChange, onSubmit, dark, sub, fg }: {
  value: string; onChange: (v: string) => void; onSubmit: () => void;
  dark: boolean; sub: string; fg: string;
}): React.ReactElement {
  return (
    <Box radius="lg" background={dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)'} padding={{ x: 12, y: 8 }} style={{ borderWidth: 1, borderColor: dark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.14)' }}>
      <Textarea
        value={value}
        onChangeText={onChange}
        placeholder="Type your answer…"
        placeholderTextColor={sub}
        autoFocus
        dark={dark}
        inputProps={{ onSubmitEditing: onSubmit, blurOnSubmit: true }}
        style={{
          color: fg,
          fontFamily: 'Calibre-Medium', fontSize: fontSize('md'), lineHeight: 22,
          minHeight: 22, padding: 0, backgroundColor: 'transparent', borderWidth: 0, height: undefined,
        }}
      />
    </Box>
  );
}

/** Renders the Submit button (multi-select / Other), disabled until there's an answer. */
function SubmitButton({ s, dark }: { s: QuestionState; dark: boolean }): React.ReactElement {
  const disabled = s.multi ? (s.selected.size === 0 && !s.otherText.trim()) : !s.otherText.trim();
  return (
    <Pressable
      onPress={s.submit}
      disabled={disabled}
      style={({ pressed }) => ({
        marginTop: 4, alignSelf: 'flex-start',
        paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
        backgroundColor: disabled
          ? (dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)')
          : pressed ? '#a08458' : '#c0a06e',
        opacity: disabled ? 0.5 : 1,
      })}
    >
      <Text weight="semibold" size="sm" color={'#000'}>
        Submit{s.multi && s.selected.size > 0 ? ` (${s.selected.size}${s.otherText.trim() ? '+1' : ''})` : ''}
      </Text>
    </Pressable>
  );
}

/** Question view: single-select fires onAnswer instantly while multi-select toggles options locally and submits the joined labels on "Submit"; an implicit "Other…" affordance (default on) allows a free-text answer instead of or alongside the listed options. */
export function QuestionView({ question, dark, sub, onAnswer }: {
  question: Question; dark: boolean; sub: string; onAnswer: (label: string) => void;
}): React.ReactElement {
  const s = useQuestionState(question, onAnswer);
  const fg = usePalette().text; /* #9f9fa3 / #57606a */
  const needSubmitButton = s.multi || s.otherOpen;
  return (
    <Box margin={{ top: 8 }} gap={6} style={{ alignSelf: 'stretch' }}>
      {question.header ? (
        <Text weight="semibold" size="3xs" color={sub} style={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {question.header}{s.multi ? ' · multi-select' : ''}
        </Text>
      ) : null}
      {question.options.map((opt, i) => (
        <OptionRow
          key={`${i}-${opt.label}`} opt={opt} isOn={s.selected.has(opt.label)}
          multi={s.multi} dark={dark} sub={sub} fg={fg} onPress={() => { s.toggle(opt.label); }}
        />
      ))}
      {s.allowOther && !s.otherOpen ? (
        <OtherToggle dark={dark} sub={sub} onPress={() => { s.setOtherOpen(true); }} />
      ) : null}
      {s.otherOpen ? (
        <OtherField value={s.otherText} onChange={s.setOtherText} onSubmit={s.submit} dark={dark} sub={sub} fg={fg} />
      ) : null}
      {needSubmitButton ? <SubmitButton s={s} dark={dark} /> : null}
    </Box>
  );
}
