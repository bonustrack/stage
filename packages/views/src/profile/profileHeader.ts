import type { ColNode, WidgetNode } from '@stage-labs/kit/kit';

export interface ProfileHeaderParams {
  name: string;
}

export function profileHeader(params: ProfileHeaderParams): ColNode {
  const children: WidgetNode[] = [
    { type: 'Text', value: params.name, weight: 'semibold', size: '4xl', textAlign: 'start' },
  ];
  return { type: 'Col', gap: 6, align: 'start', children };
}
