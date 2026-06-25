import type { ColNode, WidgetNode } from '@stage-labs/kit/chatkit';
import { caption, col, icon, row, title } from '../primitives';

export interface BalanceAction {
  label: string;
  icon: string;
  pressType: string;
  payload?: Record<string, unknown>;
}

export interface BalanceHeaderParams {
  total: string;
  totalDecimals?: string;
  subtitle?: string;
  actions?: BalanceAction[];
}

function actionNode(action: BalanceAction): WidgetNode {
  return col(
    [
      icon(action.icon, { color: 'link', size: 'xl' }),
      caption(action.label, { weight: 'semibold' }),
    ],
    { gap: 6, align: 'center' },
  );
}

export function balanceHeader(params: BalanceHeaderParams): ColNode {
  const total = row(
    [
      title(params.total, { weight: 'semibold', size: '5xl' }),
      ...(params.totalDecimals !== undefined
        ? [title(params.totalDecimals, { weight: 'semibold', size: '5xl', color: 'secondary' })]
        : []),
    ],
    { align: 'end' },
  );
  const children: WidgetNode[] = [total];
  if (params.subtitle !== undefined) {
    children.push(caption(params.subtitle, { color: 'secondary' }));
  }
  if (params.actions && params.actions.length > 0) {
    children.push(
      row(params.actions.map(actionNode), { gap: 12, justify: 'start' }),
    );
  }
  return col(children, { gap: 12 });
}
