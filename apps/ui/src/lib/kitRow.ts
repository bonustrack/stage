import type {
  BasicNode,
  ListViewItemNode,
  ListViewNode,
  WidgetNode,
} from '@stage-labs/kit/kit';

export function basicRoot(child: WidgetNode): BasicNode {
  return { type: 'Basic', children: [child] };
}

export function listRoot(item: ListViewItemNode): ListViewNode {
  return { type: 'ListView', children: [item] };
}
