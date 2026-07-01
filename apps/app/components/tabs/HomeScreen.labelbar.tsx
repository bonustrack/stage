
import { useMemo, useState } from 'react';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { ViewHost } from '@stage-labs/kit/react-native/view-host';
import type { PayloadHandlers } from '@stage-labs/kit/kit';
import { basicRoot, labelBar, LABEL_CHIP_PRESS, type LabelBarChip } from '@stage-labs/views';
import { Box } from '../layout';
import { usePalette } from '../../lib/theme';
import type { SimultaneousRefs } from '../SwipeTabs.types';

const UNREAD_VALUE = '__unread__';

export function useHomeFilters(): {
  enabledLabels: Set<string>;
  toggleLabel: (label: string) => void;
  unreadOnly: boolean;
  toggleUnread: () => void;
  clearAllFilters: () => void;
} {
  const [enabledLabels, setEnabledLabels] = useState<Set<string>>(new Set());
  const toggleLabel = (label: string): void => { setEnabledLabels(prev => {
    const next = new Set(prev), key = label.toLowerCase();
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  }); };
  const [unreadOnly, setUnreadOnly] = useState<boolean>(false);
  const toggleUnread = (): void => { setUnreadOnly(v => !v); };
  const clearAllFilters = (): void => { setEnabledLabels(new Set()); setUnreadOnly(false); };
  return { enabledLabels, toggleLabel, unreadOnly, toggleUnread, clearAllFilters };
}

export function deriveLabels(rows: { labels?: string[] }[]): string[] {
  const seen = new Map<string, string>();
  for (const r of rows) {
    for (const label of r.labels ?? []) {
      const key = label.toLowerCase();
      if (!seen.has(key)) seen.set(key, label);
    }
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

export function LabelFilterBar({ labels, enabled, unreadOnly, onToggle, onToggleUnread, onClearAll, panRef }: {
  labels: string[];
  enabled: Set<string>;
  unreadOnly: boolean;
  onToggle: (label: string) => void;
  onToggleUnread: () => void;
  onClearAll: () => void;
  panRef?: SimultaneousRefs;
}): React.ReactElement {
  const { link, text: fg, bg, border: rowBg } = usePalette();
  const allSelected = !unreadOnly && enabled.size === 0;

  const chips: LabelBarChip[] = [
    { value: '', label: 'All', selected: allSelected },
    { value: UNREAD_VALUE, label: 'Unread', selected: unreadOnly },
    ...labels.map(label => ({
      value: label,
      label,
      selected: enabled.has(label.toLowerCase()),
    })),
  ];

  const node = basicRoot(
    labelBar({
      chips,
      selectedBackground: link,
      selectedLabelColor: bg,
      restBackground: rowBg,
      restLabelColor: fg,
    }),
  );
  const actions: PayloadHandlers = {
    [LABEL_CHIP_PRESS]: (payload) => {
      const value = payload.value;
      if (typeof value !== 'string') return;
      if (value === '') { onClearAll(); return; }
      if (value === UNREAD_VALUE) { onToggleUnread(); return; }
      onToggle(value);
    },
  };

  const gesture = useMemo(
    () => (panRef ? Gesture.Native().simultaneousWithExternalGesture(panRef) : Gesture.Native()),
    [panRef],
  );

  return (
    <GestureDetector gesture={gesture}>
      <Box style={{ alignSelf: 'stretch' }}>
        <ViewHost node={node} actions={actions} />
      </Box>
    </GestureDetector>
  );
}
