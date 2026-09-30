import type { AppIconName } from '../appIcons';

interface BubbleMenuItem {
  id: 'reply' | 'copy' | 'select' | 'shareLink' | 'delete';
  icon: AppIconName;
  label: string;
  danger?: boolean;
}

export function bubbleMenuItems(
  hasText: boolean, { selectText, canDelete = false }: { selectText: boolean; canDelete?: boolean },
): BubbleMenuItem[] {
  const items: (BubbleMenuItem | false)[] = [
    { id: 'reply', icon: 'IconArrowUndoUp', label: 'Reply' },
    hasText && { id: 'copy', icon: 'IconSquareBehindSquare1', label: 'Copy' },
    hasText && selectText && { id: 'select', icon: 'IconFileBend', label: 'Select' },
    { id: 'shareLink', icon: 'IconPaperPlane', label: 'Share link' },
    canDelete && { id: 'delete', icon: 'IconTrashCan', label: 'Delete', danger: true },
  ];
  return items.filter((item): item is BubbleMenuItem => item !== false);
}
