import type { MenuItem } from '../appIcons';

type BubbleMenuItem = MenuItem<'reply' | 'copy' | 'select' | 'addToDashboard' | 'shareLink' | 'delete'>;

export function bubbleMenuItems(
  hasText: boolean, { selectText, canDelete = false, frame = false }: { selectText: boolean; canDelete?: boolean; frame?: boolean },
): BubbleMenuItem[] {
  const items: (BubbleMenuItem | false)[] = [
    { id: 'reply', icon: 'IconArrowUndoUp', label: 'Reply' },
    hasText && { id: 'copy', icon: 'IconSquareBehindSquare1', label: 'Copy' },
    hasText && selectText && { id: 'select', icon: 'IconFileBend', label: 'Select' },
    frame && { id: 'addToDashboard', icon: 'IconLayoutDashboard', label: 'Add to dashboard' },
    { id: 'shareLink', icon: 'IconPaperPlane', label: 'Share link' },
    canDelete && { id: 'delete', icon: 'IconTrashCan', label: 'Delete', danger: true },
  ];
  return items.filter((item): item is BubbleMenuItem => item !== false);
}
