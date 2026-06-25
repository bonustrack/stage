import type { ColNode, WidgetNode } from '@stage-labs/kit/kit';
import { compact, compactList } from '../node';
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

interface OptionScope {
  label: string;
  stats: string;
  fillWidth: string;
  fillBackground: string;
  background?: string;
  borderColor: string;
  qi: number;
  oi: number;
  selected: boolean;
}

function optionScope(
  params: PollCardParams,
  qi: number,
  oi: number,
  option: PollOption,
  multiSelect: boolean,
): OptionScope {
  const selected = option.selected === true;
  const prefix = selected ? '✓ ' : multiSelect ? '☐ ' : '';
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
  };
}

function optionStack(scope: OptionScope): WidgetNode {
  return {
    type: 'Stack',
    children: [
      compact({
        type: 'Box' as const,
        inset: 0,
        radius: 'lg' as const,
        background: scope.background,
        border: { size: 1, color: scope.borderColor },
      }),
      {
        type: 'Box',
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: scope.fillWidth,
        radius: 'lg',
        background: scope.fillBackground,
      },
      {
        type: 'Row',
        align: 'center',
        justify: 'between',
        gap: 8,
        padding: { x: 12, y: 8 },
        children: [
          {
            type: 'Col',
            flex: 1,
            children: [{ type: 'Text', value: scope.label, truncate: true }],
          },
          { type: 'Caption', value: scope.stats, color: 'secondary', weight: 'semibold' },
        ],
      },
    ],
  };
}

function optionNode(scope: OptionScope, pressable: boolean): WidgetNode {
  const stack = optionStack(scope);
  if (!pressable) return stack;
  return {
    type: 'Pressable',
    onClickAction: {
      type: POLL_OPTION_PRESS,
      payload: {
        questionIndex: scope.qi,
        optionIndex: scope.oi,
        selected: scope.selected,
      },
    },
    children: [stack],
  };
}

function questionNode(
  params: PollCardParams,
  question: PollQuestion,
  qi: number,
): WidgetNode {
  const suffix = question.multiSelect === true ? ' · multi-select' : '';
  const pressable = params.dispatchPress === true;
  const hasQuestion = question.question !== undefined && question.question !== '';
  const hasHeader = question.header !== undefined && question.header !== '';
  const children = compactList<WidgetNode>([
    hasQuestion
      ? { type: 'Text', value: question.question, weight: 'semibold', size: '3xl' }
      : undefined,
    hasHeader
      ? {
          type: 'Caption',
          value: `${question.header ?? ''}${suffix}`,
          color: 'secondary',
          weight: 'semibold',
        }
      : undefined,
    ...question.options.map((option, oi) =>
      optionNode(
        optionScope(params, qi, oi, option, question.multiSelect === true),
        pressable,
      ),
    ),
    {
      type: 'Caption',
      value: `${question.total} vote${question.total === 1 ? '' : 's'}`,
      color: 'secondary',
    },
  ]);
  return { type: 'Col', gap: 6, children };
}

export function pollCard(params: PollCardParams): ColNode {
  return {
    type: 'Col',
    gap: 12,
    children: params.questions.map((question, qi) =>
      questionNode(params, question, qi),
    ),
  };
}
