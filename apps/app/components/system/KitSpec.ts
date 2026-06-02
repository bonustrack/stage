/** Declarative prop-spec for the Kit page — the data-driven heart of the
 *  Storybook explorer. TS types are erased at runtime, so true reflection is
 *  impossible; instead each kit component is described by an array of strongly
 *  typed control descriptors (a ControlSpec). The generic ControlsForm renders
 *  any spec → the right widget per `kind` (enum→segmented, boolean→Switch,
 *  string→TextInput, number→numeric, icon→icon picker) and produces the props
 *  object the live preview spreads. Adding a future component = add a spec here,
 *  no new form code.
 *
 *  Strong typing: a spec is `ControlSpec<S>` where S is the props/state shape;
 *  each descriptor's `key` is `keyof S` and its `default`/value type matches
 *  S[key]. `defaultsOf` derives the initial state object from a spec. */

import { type ButtonSize, type ButtonVariant } from '@metro-labs/kit/button';
import { type HeroIconName } from '@metro-labs/kit/icon';
import {
  type TextSizeToken, type TextVariant, type TextWeight,
} from '@metro-labs/kit/text';
import { type TitleLevel } from '@metro-labs/kit/title';

/** One control descriptor. Discriminated on `kind`; `K` is the prop key (keyed
 *  into the component state S), and the value type matches S[K]. */
export type Control<S, K extends keyof S = keyof S> = {
  key: K;
  label: string;
} & (
  | {
      kind: 'enum';
      options: ReadonlyArray<S[K]>;
      /** Human label for an option (defaults to String(value)). */
      labelOf?: (v: S[K]) => string;
      default: S[K];
    }
  | { kind: 'boolean'; default: S[K] }
  | { kind: 'string'; placeholder?: string; default: S[K] }
  | { kind: 'number'; min?: number; default: S[K] }
  | { kind: 'icon'; default: S[K] }
);

/** A whole component's spec: a tuple of per-prop controls over state shape S. */
export type ControlSpec<S> = ReadonlyArray<Control<S, keyof S>>;

/** Derive the initial state object (every key → its `default`) from a spec. */
export function defaultsOf<S>(spec: ControlSpec<S>): S {
  const out = {} as S;
  for (const c of spec) out[c.key] = c.default;
  return out;
}

/* ------------------------------------------------------------------ Button */

export interface ButtonState {
  variant: ButtonVariant;
  size: ButtonSize;
  label: string;
  pill: boolean;
  fullWidth: boolean;
  disabled: boolean;
  loading: boolean;
  icon: HeroIconName;
}

export const BUTTON_SPEC: ControlSpec<ButtonState> = [
  {
    key: 'variant', label: 'Variant', kind: 'enum', default: 'primary',
    options: ['primary', 'secondary', 'ghost', 'danger'],
  },
  { key: 'size', label: 'Size', kind: 'enum', default: 'md', options: ['sm', 'md', 'lg', 'xl'] },
  { key: 'label', label: 'Label', kind: 'string', default: 'Button', placeholder: 'Button' },
  { key: 'pill', label: 'Pill (icon-only)', kind: 'boolean', default: false },
  { key: 'fullWidth', label: 'Full width', kind: 'boolean', default: false },
  { key: 'disabled', label: 'Disabled', kind: 'boolean', default: false },
  { key: 'loading', label: 'Loading', kind: 'boolean', default: false },
  { key: 'icon', label: 'Icon', kind: 'icon', default: 'send' },
];

/* ------------------------------------------------------------------- Title */

export interface TitleState {
  level: TitleLevel;
  text: string;
}

export const TITLE_SPEC: ControlSpec<TitleState> = [
  {
    key: 'level', label: 'Level', kind: 'enum', default: 1,
    options: [1, 2, 3], labelOf: (l) => `Level ${l}`,
  },
  {
    key: 'text', label: 'Text', kind: 'string', default: 'The quick brown fox',
    placeholder: 'The quick brown fox',
  },
];

/* -------------------------------------------------------------------- Text */

export interface TextState {
  variant: TextVariant;
  size: TextSizeToken;
  weight: TextWeight;
  text: string;
}

export const TEXT_SPEC: ControlSpec<TextState> = [
  {
    key: 'variant', label: 'Variant', kind: 'enum', default: 'body',
    options: ['body', 'secondary', 'caption', 'mono'],
  },
  { key: 'size', label: 'Size', kind: 'enum', default: 'md', options: ['sm', 'md', 'lg'] },
  {
    key: 'weight', label: 'Weight', kind: 'enum', default: 'regular',
    options: ['regular', 'medium', 'semibold'],
  },
  {
    key: 'text', label: 'Text', kind: 'string',
    default: 'The quick brown fox (0x1234…abcd)',
  },
];

/* -------------------------------------------------------------------- Icon */

const ICON_SIZES: ReadonlyArray<number> = [16, 24, 32, 40];
const ICON_COLORS: ReadonlyArray<string> = ['#0ea5e9', '#ef4444', '#22c55e', '#a855f7'];

export interface IconState {
  name: HeroIconName;
  size: number;
  color: string;
}

export const ICON_SPEC: ControlSpec<IconState> = [
  { key: 'name', label: 'Name', kind: 'icon', default: 'send' },
  {
    key: 'size', label: 'Size', kind: 'enum', default: 24,
    options: ICON_SIZES, labelOf: (s) => `${s}px`,
  },
  { key: 'color', label: 'Colour', kind: 'enum', default: ICON_COLORS[0], options: ICON_COLORS },
];
