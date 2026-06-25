import type { ColNode } from '@stage-labs/kit/kit';
import view from './pollCard.json';
import { buildView } from '../buildView';
import { POLL_OPTION_PRESS } from '../actions';

export interface PollOption {
  label: string;
  votes: number;
  pct: number;
  selected?: boolean;
}

export interface PollQuestion {
  question: string;
  header?: string;
  multiSelect?: boolean;
  options: PollOption[];
  total: number;
}

export interface PollCardParams {
  questions: PollQuestion[];
  fillBackground?: string;
  selectedBackground?: string;
  selectedBorderColor?: string;
  borderColor?: string;
  dispatchPress?: boolean;
}

function optionScope(
  params: PollCardParams,
  qi: number,
  oi: number,
  option: PollOption,
  multiSelect: boolean,
): Record<string, unknown> {
  const selected = option.selected === true;
  const prefix = selected ? '✓ ' : multiSelect ? '☐ ' : '';
  const pressable = params.dispatchPress === true;
  return {
    label: `${prefix}${option.label}`,
    stats: `${option.pct}% · ${option.votes}`,
    fillWidth: `${Math.max(0, Math.min(100, option.pct))}%`,
    fillBackground: params.fillBackground ?? 'transparent',
    background: selected ? params.selectedBackground : undefined,
    borderColor:
      selected && params.selectedBorderColor !== undefined
        ? params.selectedBorderColor
        : params.borderColor ?? 'transparent',
    qi,
    oi,
    selected,
    bare: !pressable || undefined,
    pressable: pressable || undefined,
  };
}

function questionScope(
  params: PollCardParams,
  question: PollQuestion,
  qi: number,
): Record<string, unknown> {
  const suffix = question.multiSelect === true ? ' · multi-select' : '';
  return {
    question: question.question,
    hasQuestion:
      (question.question !== undefined && question.question !== '') || undefined,
    hasHeader:
      (question.header !== undefined && question.header !== '') || undefined,
    headerLabel: `${question.header ?? ''}${suffix}`,
    options: question.options.map((option, oi) =>
      optionScope(params, qi, oi, option, question.multiSelect === true),
    ),
    totalLabel: `${question.total} vote${question.total === 1 ? '' : 's'}`,
  };
}

export function pollCard(params: PollCardParams): ColNode {
  return (buildView(view, {
    pollPressType: POLL_OPTION_PRESS,
    questions: params.questions.map((question, qi) =>
      questionScope(params, question, qi),
    ),
  }) as ColNode);
}
