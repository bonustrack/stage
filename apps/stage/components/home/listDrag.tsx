import { useMemo, type ReactNode } from 'react';
import {
  SortableHandle,
  SortableItem,
  SortableList,
  SortableScope,
  useSortableTarget,
  type SortMove,
} from '@stage-labs/kit/react-native/sortable';
import { setChannelCategory } from '../channel/channel.labels';
import { moveCategory } from '../../lib/channelGroups';
import { movePin } from '../../lib/pins';
import { usePalette } from '../../lib/theme';
import type { MenuPoint } from '../AnchoredMenu.model';
import type { HomeListItem } from './groups.model';
import { Column } from '../layout';
import { homeDragModel, pinMove, sectionMove, zoneAt, zoneMove, type HomeDragModel } from './listDrag.model';

const PIN_LIST = 'home-pins';
const SECTION_LIST = 'home-sections';
const ROW_LIST = 'home-rows';
const FILL = { flex: 1 };

export interface HomeDrag {
  model: HomeDragModel;
  pins: readonly string[];
  onPin: (move: SortMove) => void;
  onSection: (move: SortMove) => void;
  onZone: (move: SortMove) => void;
}

export function useHomeDrag(
  items: readonly HomeListItem[],
  byCategory: boolean,
  pinned: readonly string[],
  visiblePinned: readonly string[],
): HomeDrag {
  const model = useMemo(() => homeDragModel(items, byCategory), [items, byCategory]);
  return useMemo(
    () => ({
      model,
      pins: visiblePinned,
      onPin: (move) => {
        const index = pinMove(pinned, move);
        if (index !== null) movePin(move.itemId, index);
      },
      onSection: (move) => {
        const next = sectionMove(model, move);
        if (next !== null) moveCategory(next.key, next.target, next.visible);
      },
      onZone: (move) => {
        const next = zoneMove(model, move);
        if (next !== null) setChannelCategory(next.convId, next.category);
      },
    }),
    [model, pinned, visiblePinned],
  );
}

export function HomeDragLists({ drag, children }: { drag: HomeDrag; children: ReactNode }): React.ReactElement {
  return (
    <SortableScope style={FILL}>
      <SortableList
        listId={PIN_LIST}
        itemIds={drag.pins}
        indicator="shift"
        keyboard={false}
        touchAction="pan-y"
        style={FILL}
        onMove={drag.onPin}
      >
        <SortableList
          listId={SECTION_LIST}
          itemIds={drag.model.sections}
          indicator="shift"
          keyboard={false}
          touchAction="pan-y"
          style={FILL}
          onMove={drag.onSection}
        >
          <SortableList
            listId={ROW_LIST}
            itemIds={drag.model.rows}
            indicator="follow"
            keyboard={false}
            touchAction="pan-y"
            style={FILL}
            accepts={(move) => zoneMove(drag.model, move) !== null}
            onMove={drag.onZone}
          >
            {children}
          </SortableList>
        </SortableList>
      </SortableList>
    </SortableScope>
  );
}

function Lifted({ dragging, children }: { dragging: boolean; children: ReactNode }): React.ReactElement {
  const { border } = usePalette();
  return <Column background={dragging ? border : undefined}>{children}</Column>;
}

function ZoneShade({ model, id, children }: { model: HomeDragModel; id: string; children: ReactNode }): React.ReactElement {
  const { inputBg } = usePalette();
  const target = useSortableTarget(ROW_LIST);
  const zone = target === null ? undefined : zoneAt(model, target.itemId, target.index);
  const lit = zone !== undefined && model.zoneOf.get(id) === zone;
  return <Column background={lit ? inputBg : undefined}>{children}</Column>;
}

export function PinnedRow({
  drag,
  convId,
  onHold,
  children,
}: {
  drag: HomeDrag;
  convId: string;
  onHold: (anchor: MenuPoint) => void;
  children: ReactNode;
}): React.ReactElement {
  if (!drag.pins.includes(convId)) return <>{children}</>;
  return (
    <SortableItem listId={PIN_LIST} itemId={convId} onHold={onHold}>
      {({ dragging }) => <Lifted dragging={dragging}>{children}</Lifted>}
    </SortableItem>
  );
}

export function SectionHandle({ children }: { children: React.ReactElement }): React.ReactElement {
  return <SortableHandle>{children}</SortableHandle>;
}

export function DragCell({
  drag,
  item,
  onHold,
  children,
}: {
  drag: HomeDrag;
  item: HomeListItem;
  onHold?: (anchor: MenuPoint) => void;
  children: ReactNode;
}): React.ReactElement {
  const { model } = drag;
  const id = item.convId;
  const header = model.sectionKeys.has(id);
  const zoned = model.zoneOf.has(id);
  const inner = !zoned ? (
    children
  ) : (
    <SortableItem listId={ROW_LIST} itemId={id} disabled={id === model.zoneOf.get(id)} onHold={onHold}>
      {({ dragging }) => (
        <ZoneShade model={model} id={id}>
          <Lifted dragging={dragging}>{children}</Lifted>
        </ZoneShade>
      )}
    </SortableItem>
  );
  const section = header ? id : model.sectionOf.get(id);
  if (section === undefined) return <>{inner}</>;
  return (
    <SortableItem listId={SECTION_LIST} itemId={id} handle={header} follows={header ? undefined : section}>
      {({ dragging }) => <Lifted dragging={dragging}>{inner}</Lifted>}
    </SortableItem>
  );
}
