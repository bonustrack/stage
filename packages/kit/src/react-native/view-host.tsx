
import { useMemo } from 'react';
import { KitRenderer } from './kit-renderer';
import {
  payloadRegistry,
  type PayloadHandlers,
  type WidgetDataContext,
  type WidgetRoot,
} from '../kit';

export interface ViewHostProps {
  node: WidgetRoot;
  actions?: PayloadHandlers;
  data?: WidgetDataContext;
}

export function ViewHost({ node, actions, data }: ViewHostProps): React.ReactElement {
  const registry = useMemo(() => payloadRegistry(actions ?? {}), [actions]);
  return <KitRenderer node={node} registry={registry} data={data} />;
}
