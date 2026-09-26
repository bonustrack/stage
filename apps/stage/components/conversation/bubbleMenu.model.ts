import type { AppIconName } from '../appIcons';

interface BubbleMenuItem {
  id: 'reply' | 'copy' | 'select' | 'shareLink';
  icon: AppIconName;
  label: string;
}

export function bubbleMenuItems(hasText: boolean, { selectText }: { selectText: boolean }): BubbleMenuItem[] {
  const items: (BubbleMenuItem | false)[] = [
    { id: 'reply', icon: 'IconArrowUndoUp', label: 'Reply' },
    hasText && { id: 'copy', icon: 'IconSquareBehindSquare1', label: 'Copy' },
    hasText && selectText && { id: 'select', icon: 'IconFileBend', label: 'Select' },
    { id: 'shareLink', icon: 'IconPaperPlane', label: 'Share link' },
  ];
  return items.filter((item): item is BubbleMenuItem => item !== false);
}
