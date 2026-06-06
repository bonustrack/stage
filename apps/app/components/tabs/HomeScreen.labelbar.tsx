/** Home label-filter bar — a horizontally scrollable row of chips rendered
 *  directly under the search bar. One chip per UNIQUE label collected across all
 *  NON-ARCHIVED channels. Each chip toggles a filter on/off; when one or more is
 *  enabled the channels list narrows to chats carrying ANY of the enabled labels
 *  (OR semantics). Enabled chips are filled (link-tinted) to stay visible.
 *
 *  Reuses the compact rounded chip styling from ChannelRow's read-only label
 *  chips for visual consistency. Presentation only — the enabled set is owned by
 *  HomeScreen and passed down. */

import { ScrollView, Pressable } from 'react-native';
import { Text } from '@metro-labs/kit/text';
import { usePalette } from '../../lib/theme';

/** Derive the unique label set (case-insensitive, first-seen casing preserved)
 *  across the supplied rows. Callers pass NON-ARCHIVED rows only. */
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

/** A single toggle chip. Filled (link bg) when enabled, tinted-border when off. */
function LabelChip({ label, enabled, onPress, link, fg, rowBg }: {
  label: string;
  enabled: boolean;
  onPress: () => void;
  link: string;
  fg: string;
  rowBg: string;
}): React.ReactElement {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => ({
        paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999,
        backgroundColor: enabled ? link : rowBg,
        opacity: pressed ? 0.7 : 1, flexShrink: 0,
      })}
    >
      <Text
        numberOfLines={1}
        style={{
          color: enabled ? '#ffffff' : fg,
          fontSize: 13,
          fontFamily: enabled ? 'Calibre-Semibold' : 'Calibre-Medium',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** The horizontal label-filter bar. Renders nothing when there are no labels. */
export function LabelFilterBar({ labels, enabled, onToggle }: {
  labels: string[];
  enabled: Set<string>;
  onToggle: (label: string) => void;
}): React.ReactElement | null {
  const { link, text: fg, border: rowBg } = usePalette();
  if (labels.length === 0) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingVertical: 10 }}
    >
      {labels.map(label => (
        <LabelChip
          key={label.toLowerCase()}
          label={label}
          enabled={enabled.has(label.toLowerCase())}
          onPress={() => onToggle(label)}
          link={link}
          fg={fg}
          rowBg={rowBg}
        />
      ))}
    </ScrollView>
  );
}
