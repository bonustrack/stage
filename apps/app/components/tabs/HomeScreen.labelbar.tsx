
import { useMemo, useState } from 'react';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { ViewHost } from '@stage-labs/kit/react-native/view-host';
import { channelsLabelBarActions, channelsLabelBarNode } from '@stage-labs/views';
import { Box } from '../layout';
import { usePalette } from '../../lib/theme';
import type { SimultaneousRefs } from '../SwipeTabs.types';


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

export { deriveBarLabels as deriveLabels } from '@stage-labs/client/xmtp/channelsFilter';

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
  const node = channelsLabelBarNode(
    { barLabels: labels, enabledLabels: enabled, unreadOnly },
    { selectedBackground: link, selectedLabelColor: bg, restBackground: rowBg, restLabelColor: fg },
  );
  const actions = channelsLabelBarActions({
    onClearAll,
    onToggleUnread,
    onToggleLabel: onToggle,
  });

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
