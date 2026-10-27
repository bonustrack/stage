import type { ReactNode } from 'react';
import { isChildTemplate, isDataBinding, type JsonValue } from '../a2ui/protocol';
import { movedItems } from '../sortable';
import { DENSITY_SCALE } from '../tokens';
import { asEnum, asNumber, asOptionalString, commonProps, type RenderContext } from './a2ui-context';
import { List } from './list';
import { SortableItem, SortableList, type SortMove, type SortSource } from './sortable';

const ALIGN = ['start', 'center', 'end', 'stretch'] as const;
const GAP = DENSITY_SCALE.normal.gap;

function keyOf(row: JsonValue, itemKey: string, index: number): string {
  const value = typeof row === 'object' && row !== null && !Array.isArray(row) ? row[itemKey] : undefined;
  return typeof value === 'string' || typeof value === 'number' ? String(value) : `#${index}`;
}

function rowsAt(ctx: RenderContext, pointer: string): JsonValue[] {
  const value = ctx.read(pointer);
  return Array.isArray(value) ? value : [];
}

function applyMove(ctx: RenderContext, here: string, itemKey: string, move: SortMove, source: SortSource): void {
  const from = typeof source.payload === 'string' ? source.payload : here;
  const sourceRows = rowsAt(ctx, from);
  const fromIndex = sourceRows.findIndex((row, index) => keyOf(row, itemKey, index) === move.itemId);
  if (fromIndex === -1) return;
  if (from === here) {
    ctx.write(here, movedItems(sourceRows, null, fromIndex, move.toIndex).target);
    return;
  }
  const next = movedItems(sourceRows, rowsAt(ctx, here), fromIndex, move.toIndex);
  ctx.write(from, next.source);
  ctx.write(here, next.target);
}

export function isSortableList(ctx: RenderContext): boolean {
  return ctx.props.sortable === true && isChildTemplate(ctx.instance.children);
}

export function sortableListRenderer(ctx: RenderContext): ReactNode {
  const p = ctx.props;
  const template = ctx.instance.children;
  if (!isChildTemplate(template)) return null;
  const here = ctx.pointer(template.path);
  const itemKey = asOptionalString(p.itemKey) ?? 'id';
  const ids = rowsAt(ctx, here).map((row, index) => keyOf(row, itemKey, index));
  const children = ctx.children(template);
  const movePath = isDataBinding(ctx.instance.move) ? ctx.pointer(ctx.instance.move['@path']) : null;
  const direction = asEnum(p.direction, ['vertical', 'horizontal']) ?? 'vertical';
  const onMove = (move: SortMove, source: SortSource): void => {
    applyMove(ctx, here, itemKey, move, source);
    if (movePath !== null) ctx.write(movePath, { ...move });
    ctx.action();
  };
  return (
    <List {...commonProps(ctx)} direction={direction} align={asEnum(p.align, ALIGN)}>
      <SortableList
        listId={asOptionalString(p.listId) ?? `${ctx.id}${ctx.scope.path}`}
        group={asOptionalString(p.group)}
        itemIds={ids}
        direction={direction}
        gap={asNumber(p.gap) ?? GAP}
        label={ctx.accessibility?.label}
        payload={here}
        disabled={ctx.disabled}
        onMove={onMove}
      >
        {children.map((child, index) => <SortableItem key={ids[index] ?? index} itemId={ids[index] ?? `#${index}`}>{child}</SortableItem>)}
      </SortableList>
    </List>
  );
}
