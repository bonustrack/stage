/** Home label-filter control + picker sheet — lives in the TOP-LEFT of the
 *  channels-tab topnav. Tapping the pill opens a bottom sheet listing every
 *  label the user has applied across their groups (getAllKnownLabels, read from
 *  the in-memory channelsCache) plus an "All" reset option. Selecting a label
 *  filters the channels list to groups carrying that label; "All" clears it.
 *
 *  PRESENTATION + LOCAL UI STATE ONLY — the active filter value is owned by
 *  HomeScreen and passed down so the list memo can apply it. The control
 *  highlights (tinted bg + the active label text) whenever a filter is set so
 *  it's obvious the list is narrowed. */

import { useMemo } from 'react';
import { Pressable, ScrollView } from 'react-native';
import { Text } from '@metro-labs/kit/text';
import { Icon } from '@metro-labs/kit/icon';
import { Box, Col, Row } from '../layout';
import { AppModal } from '../AppModal';
import { usePalette } from '../../lib/theme';
import { getAllKnownLabels } from '../../lib/xmtp.labels.suggest';

/** The control pill shown in the topnav. Compact: a filter glyph + the active
 *  label (or "Labels" when unfiltered). Tinted when a filter is active. */
export function LabelFilterControl({ active, onPress }: {
  active: string | null;
  onPress: () => void;
}): React.ReactElement {
  const { head, sub, rowBg } = usePalette();
  const isOn = active != null;
  return (
    <Pressable onPress={onPress} hitSlop={8}>
      <Row
        align="center"
        gap={5}
        px={isOn ? 10 : 8}
        py={5}
        radius={999}
        style={{ backgroundColor: isOn ? rowBg : 'transparent' }}
      >
        <Icon name="filter" size={18} color={isOn ? head : sub} />
        {isOn ? (
          <Text
            numberOfLines={1}
            style={{ color: head, fontSize: 14, fontFamily: 'Calibre-Semibold', maxWidth: 120 }}
          >
            {active}
          </Text>
        ) : null}
      </Row>
    </Pressable>
  );
}

/** The label-picker bottom sheet. Lists "All" (clears) + every known label,
 *  with a check on the currently-selected one. Closes on selection. */
export function LabelFilterSheet({ visible, active, onClose, onSelect }: {
  visible: boolean;
  active: string | null;
  onClose: () => void;
  onSelect: (label: string | null) => void;
}): React.ReactElement {
  const { head, sub, border, rowBg } = usePalette();
  /** Snapshot the known labels when the sheet opens (the cache is stable while
   *  open; recomputed each open so newly-added labels appear). */
  const labels = useMemo(() => (visible ? getAllKnownLabels() : []), [visible]);

  const pick = (label: string | null): void => { onSelect(label); onClose(); };

  return (
    <AppModal visible={visible} onClose={onClose} title="Filter by label">
      <Col gap={2}>
        <FilterRow
          label="All channels"
          selected={active == null}
          head={head}
          sub={sub}
          rowBg={rowBg}
          onPress={() => pick(null)}
        />
        {labels.length > 0 ? (
          <Box style={{ height: 1, backgroundColor: border, marginVertical: 6 }} />
        ) : null}
        <ScrollView style={{ maxHeight: 320 }} keyboardShouldPersistTaps="handled">
          {labels.length === 0 ? (
            <Text style={{ color: sub, fontSize: 14, fontFamily: 'Calibre-Medium', paddingVertical: 14, paddingHorizontal: 4 }}>
              No labels yet. Add labels to a group from its info screen.
            </Text>
          ) : (
            labels.map(label => (
              <FilterRow
                key={label.toLowerCase()}
                label={label}
                tag
                selected={active != null && active.toLowerCase() === label.toLowerCase()}
                head={head}
                sub={sub}
                rowBg={rowBg}
                onPress={() => pick(label)}
              />
            ))
          )}
        </ScrollView>
      </Col>
    </AppModal>
  );
}

/** A single selectable row in the picker sheet. */
function FilterRow({ label, selected, tag, head, sub, rowBg, onPress }: {
  label: string;
  selected: boolean;
  tag?: boolean;
  head: string;
  sub: string;
  rowBg: string;
  onPress: () => void;
}): React.ReactElement {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: 12,
        paddingVertical: 12, paddingHorizontal: 8, borderRadius: 10,
        backgroundColor: pressed ? rowBg : 'transparent',
      })}
    >
      {tag ? <Icon name="tag" size={18} color={sub} /> : <Icon name="collection" size={18} color={sub} />}
      <Text style={{ color: head, fontSize: 17, fontFamily: 'Calibre-Medium', flex: 1 }} numberOfLines={1}>
        {label}
      </Text>
      {selected ? <Icon name="check" size={20} color={head} /> : null}
    </Pressable>
  );
}
