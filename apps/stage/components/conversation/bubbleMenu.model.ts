interface BubbleMenuItem {
  id: 'reply' | 'copy' | 'select' | 'shareLink';
  icon: string;
  label: string;
}

export function bubbleMenuItems(hasText: boolean, { selectText }: { selectText: boolean }): BubbleMenuItem[] {
  const items: (BubbleMenuItem | false)[] = [
    { id: 'reply', icon: 'reply', label: 'Reply' },
    hasText && { id: 'copy', icon: 'copy', label: 'Copy' },
    hasText && selectText && { id: 'select', icon: 'document', label: 'Select' },
    { id: 'shareLink', icon: 'send', label: 'Share link' },
  ];
  return items.filter((item): item is BubbleMenuItem => item !== false);
}
