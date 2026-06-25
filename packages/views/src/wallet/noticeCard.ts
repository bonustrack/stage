import type { ColNode, WidgetNode } from '@stage-labs/kit/kit';
import type { ThemeColor } from '@stage-labs/kit/kit';
import { button, caption, col, icon, row, text } from '../primitives';

export interface NoticeAction {
  label: string;
  pressType: string;
  variant?: 'solid' | 'soft' | 'outline' | 'ghost';
  payload?: Record<string, unknown>;
}

export interface NoticeCardParams {
  icon?: string;
  iconColor?: ThemeColor;
  title: string;
  titleColor?: ThemeColor | 'text' | 'secondary' | 'danger' | 'link';
  description?: string;
  actions?: NoticeAction[];
  gap?: number;
}

function actionButton(action: NoticeAction): WidgetNode {
  return button({
    label: action.label,
    block: true,
    variant: action.variant,
    onClickAction: { type: action.pressType, payload: action.payload ?? {} },
  });
}

export function noticeCard(params: NoticeCardParams): ColNode {
  const titleNode = text(params.title, { weight: 'semibold', size: 'md', color: params.titleColor });
  const labelCol: WidgetNode[] = [titleNode];
  if (params.description !== undefined) {
    labelCol.push(caption(params.description, { color: 'secondary' }));
  }
  const head = row(
    [
      ...(params.icon !== undefined
        ? [icon(params.icon, { color: params.iconColor, size: 'lg' })]
        : []),
      col(labelCol, { gap: 2, flex: 1 }),
    ],
    { align: 'start', gap: 12 },
  );
  const children: WidgetNode[] = [head];
  if (params.actions && params.actions.length > 0) {
    children.push(col(params.actions.map(actionButton), { gap: 8 }));
  }
  return col(children, { gap: params.gap ?? 12 });
}
