import { useState } from 'react';
import { fontSize } from '@stage-labs/kit/tokens';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Textarea } from '@stage-labs/kit/react-native/textarea';
import { Text } from '@stage-labs/kit/react-native/text';
import { Box } from './layout';
import type { Question } from './MessengerBubble.helpers';
import { usePalette } from '../lib/theme';

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

function useQuestionState(question: Question, onAnswer: (label: string) => void): QuestionState {
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
    const chosen = question.options.filter(o => selected.has(o.label)).map(o => o.label);
    const other = otherText.trim();
    if (multi) {
      if (chosen.length === 0 && !other) return;
      onAnswer([...chosen, ...(other ? [other] : [])].join(', '));
      return;
    }
    if (!other) return;
    onAnswer(other);
  };
  return { selected, otherOpen, otherText, multi, allowOther, setOtherOpen, setOtherText, toggle, submit };
}

function optionBg(isOn: boolean, pressed: boolean, dark: boolean): string {
  if (isOn) return dark ? 'rgba(192,160,110,0.22)' : 'rgba(192,160,110,0.18)';
  if (pressed) return dark ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.08)';
  return dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)';
}

function OptionRow({ opt, isOn, multi, dark, fg, onPress }: {
  opt: Question['options'][number]; isOn: boolean; multi: boolean;
  dark: boolean; fg: string; onPress: () => void;
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
        <Text size="2xs" role="secondary" style={{ marginTop: 2 }}>{opt.description}</Text>
      ) : null}
    </Pressable>
  );
}

function OtherToggle({ dark, onPress }: { dark: boolean; onPress: () => void }): React.ReactElement {
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
      <Text size="md" role="secondary">Other…</Text>
    </Pressable>
  );
}

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

export function QuestionView({ question, dark, sub, onAnswer }: {
  question: Question; dark: boolean; sub: string; onAnswer: (label: string) => void;
}): React.ReactElement {
  const s = useQuestionState(question, onAnswer);
  const fg = usePalette().text;
  const needSubmitButton = s.multi || s.otherOpen;
  return (
    <Box margin={{ top: 8 }} gap={6} style={{ alignSelf: 'stretch' }}>
      {question.header ? (
        <Text weight="semibold" size="3xs" role="secondary" style={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {question.header}{s.multi ? ' · multi-select' : ''}
        </Text>
      ) : null}
      {question.options.map((opt, i) => (
        <OptionRow
          key={`${i}-${opt.label}`} opt={opt} isOn={s.selected.has(opt.label)}
          multi={s.multi} dark={dark} fg={fg} onPress={() => { s.toggle(opt.label); }}
        />
      ))}
      {s.allowOther && !s.otherOpen ? (
        <OtherToggle dark={dark} onPress={() => { s.setOtherOpen(true); }} />
      ) : null}
      {s.otherOpen ? (
        <OtherField value={s.otherText} onChange={s.setOtherText} onSubmit={s.submit} dark={dark} sub={sub} fg={fg} />
      ) : null}
      {needSubmitButton ? <SubmitButton s={s} dark={dark} /> : null}
    </Box>
  );
}
