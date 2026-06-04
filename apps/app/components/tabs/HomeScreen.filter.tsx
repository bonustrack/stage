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

import { useEffect, useMemo } from 'react';
import { Pressable, ScrollView } from 'react-native';
import {
  consumeLabelFilterRequest,
  subscribeLabelFilterRequest,
  clearPendingLabelFilter,
} from '../../lib/labelFilterRequest';
import { Text } from '@metro-labs/kit/text';
import { Icon } from '@metro-labs/kit/icon';
import type { HeroIconName } from '@metro-labs/kit/icon';
import { Box, Col, Row } from '../layout';
import { AppModal } from '../AppModal';
import { usePalette } from '../../lib/theme';
import { getAllKnownLabels } from '../../lib/xmtp.labels.suggest';

/** Sentinel for the "only channels with no labels" filter. A distinct symbol-ish
 *  string (can never collide with a real user label) keeps the filter state a
 *  simple union: `string` (a label) | `UNLABELED` | `null` (all channels). */
export { UNLABELED } from './HomeScreen.filter.types';
export type { LabelFilterValue } from './HomeScreen.filter.types';
import { UNLABELED } from './HomeScreen.filter.types';
import type { LabelFilterValue } from './HomeScreen.filter.types';

/** Apply cross-screen label-filter requests to HomeScreen's filter state. A
 *  label chip tapped on a channel card (here OR on another tab, which navigates
 *  to the Channels tab) sets the tapped label as the active filter via
 *  lib/labelFilterRequest. Honours a request pending on mount (chip tapped on
 *  another tab → navigated here) AND subscribes so an already-mounted Home
 *  updates live. The request seq makes a re-tap of the same label still apply. */
export function useIncomingLabelFilter(setLabelFilter: (v: LabelFilterValue) => void): void {
  useEffect(() => {
    const pending = consumeLabelFilterRequest();
    if (pending) setLabelFilter(pending.value);
    return subscribeLabelFilterRequest(req => {
      setLabelFilter(req.value);
      /** Applied live → drop the pending slot so a later remount won't re-apply. */
      clearPendingLabelFilter();
    });
    /** setLabelFilter is a stable useState setter; intentionally mount-only. */
  }, []);
}

/** Display text for the active filter in the pill. */
function filterLabelText(active: LabelFilterValue): string {
  return active === UNLABELED ? 'Unlabeled' : (active ?? '');
}

/** The control pill shown in the topnav. Compact: a filter glyph + the active
 *  label (or "Labels" when unfiltered). Tinted when a filter is active. */
export function LabelFilterControl({ active, onPress }: {
  active: LabelFilterValue;
  onPress: () => void;
}): React.ReactElement {
  const { primary: head, text: sub, border: rowBg } = usePalette();
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
            {filterLabelText(active)}
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
  active: LabelFilterValue;
  onClose: () => void;
  onSelect: (label: LabelFilterValue) => void;
}): React.ReactElement {
  const { primary: head, text: sub, border } = usePalette();
  const rowBg = border;  /** Snapshot the known labels when the sheet opens (the cache is stable while
   *  open; recomputed each open so newly-added labels appear). */
  const labels = useMemo(() => (visible ? getAllKnownLabels() : []), [visible]);

  const pick = (label: LabelFilterValue): void => { onSelect(label); onClose(); };

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
        <FilterRow
          label="Unlabeled"
          icon="tag"
          selected={active === UNLABELED}
          head={head}
          sub={sub}
          rowBg={rowBg}
          onPress={() => pick(UNLABELED)}
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

/** A single selectable row in the picker sheet. `tag` picks the label glyph;
 *  `icon` overrides the glyph entirely (e.g. the Unlabeled row). */
function FilterRow({ label, selected, tag, icon, head, sub, rowBg, onPress }: {
  label: string;
  selected: boolean;
  tag?: boolean;
  icon?: HeroIconName;
  head: string;
  sub: string;
  rowBg: string;
  onPress: () => void;
}): React.ReactElement {
  const glyph = icon ?? (tag ? 'tag' : 'collection');
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: 12,
        paddingVertical: 12, paddingHorizontal: 8, borderRadius: 10,
        backgroundColor: pressed ? rowBg : 'transparent',
      })}
    >
      <Icon name={glyph} size={18} color={sub} />
      <Text style={{ color: head, fontSize: 17, fontFamily: 'Calibre-Medium', flex: 1 }} numberOfLines={1}>
        {label}
      </Text>
      {selected ? <Icon name="check" size={20} color={head} /> : null}
    </Pressable>
  );
}
