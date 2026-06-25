import type { ColNode, WidgetNode } from '@stage-labs/kit/kit';
import { POLL_OPTION_PRESS } from '../actions';
import { caption, col, row, text } from '../primitives';

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

function optionNode(
  params: PollCardParams,
  qi: number,
  oi: number,
  option: PollOption,
  multiSelect: boolean,
): WidgetNode {
  const selected = option.selected === true;
  const prefix = selected ? '✓ ' : multiSelect ? '☐ ' : '';
  const content = row(
    [
      col([text(`${prefix}${option.label}`, { truncate: true })], { flex: 1 }),
      caption(`${option.pct}% · ${option.votes}`, {
        color: 'secondary',
        weight: 'semibold',
      }),
    ],
    {
      align: 'center',
      justify: 'between',
      gap: 8,
      padding: { x: 12, y: 8 },
      radius: 'lg',
      background: selected ? params.selectedBackground : undefined,
      border: {
        size: 1,
        color:
          selected && params.selectedBorderColor !== undefined
            ? params.selectedBorderColor
            : (params.borderColor ?? 'transparent'),
      },
    },
  );
  if (params.dispatchPress !== true) return content;
  return {
    type: 'ListViewItem',
    onClickAction: {
      type: POLL_OPTION_PRESS,
      payload: { questionIndex: qi, optionIndex: oi, selected },
    },
    children: [content],
  };
}

function questionNode(
  params: PollCardParams,
  question: PollQuestion,
  qi: number,
): WidgetNode {
  const lines: WidgetNode[] = [
    text(question.question, { weight: 'semibold', size: 'lg' }),
  ];
  if (question.header !== undefined && question.header !== '') {
    const suffix = question.multiSelect === true ? ' · multi-select' : '';
    lines.push(
      caption(`${question.header}${suffix}`, {
        color: 'secondary',
        weight: 'semibold',
      }),
    );
  }
  question.options.forEach((option, oi) =>
    lines.push(optionNode(params, qi, oi, option, question.multiSelect === true)),
  );
  lines.push(
    caption(`${question.total} vote${question.total === 1 ? '' : 's'}`, {
      color: 'secondary',
    }),
  );
  return col(lines, { gap: 6 });
}

export function pollCard(params: PollCardParams): ColNode {
  return col(
    params.questions.map((question, qi) => questionNode(params, question, qi)),
    { gap: 12 },
  );
}
