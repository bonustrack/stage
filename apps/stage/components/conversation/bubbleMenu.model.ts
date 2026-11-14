import type { MenuItem } from '../appIcons';

type BubbleMenuItem = MenuItem<'reply' | 'copy' | 'select' | 'addToDashboard' | 'shareLink' | 'report' | 'delete'>;

interface BubbleMenuOptions {
  selectText: boolean;
  canDelete?: boolean;
  canReport?: boolean;
  frame?: boolean;
  developerMode?: boolean;
}

const COPY: BubbleMenuItem = { id: 'copy', icon: 'IconSquareBehindSquare1', label: 'Copy' };
const SELECT: BubbleMenuItem = { id: 'select', icon: 'IconFileBend', label: 'Select' };

function textItems(hasText: boolean, selectText: boolean): BubbleMenuItem[] {
  if (!hasText) return [];
  return selectText ? [COPY, SELECT] : [COPY];
}

function when(on: boolean | undefined, item: BubbleMenuItem): BubbleMenuItem[] {
  return on === true ? [item] : [];
}

export function bubbleMenuItems(hasText: boolean, o: BubbleMenuOptions): BubbleMenuItem[] {
  return [
    { id: 'reply', icon: 'IconArrowUndoUp', label: 'Reply' },
    ...textItems(hasText, o.selectText),
    ...when(o.frame === true && o.developerMode === true, { id: 'addToDashboard', icon: 'IconBento', label: 'Add to dashboard' }),
    { id: 'shareLink', icon: 'IconPaperPlane', label: 'Share link' },
    ...when(o.canReport, { id: 'report', icon: 'IconFlag1', label: 'Report' }),
    ...when(o.canDelete, { id: 'delete', icon: 'IconTrashCan', label: 'Delete', danger: true }),
  ];
}
