/** Inline filter sheet — multi-select chips + free-text fields. Session-only state. */

import { Modal, Pressable, ScrollView, Text, TextInput, View, useColorScheme } from 'react-native';
import type { HistoryEntry, HistoryKind } from '../lib/types';
import { Chip, ChipRow, Section, StationChip, inputStyle } from './FilterSheetParts';

export type StationKey = 'discord' | 'telegram' | 'webhook' | 'claude' | 'codex';
export const ALL_KINDS: HistoryKind[] = ['inbound', 'outbound', 'edit', 'react'];
export const ALL_STATIONS: StationKey[] = ['discord', 'telegram', 'webhook', 'claude', 'codex'];

export interface Filters {
  kinds: Set<HistoryKind>;
  stations: Set<StationKey>;
  from: string;
  to: string;
  line: string;
  includeWebhooks: boolean;
}

export const emptyFilters = (): Filters => ({
  kinds: new Set(),
  stations: new Set(),
  from: '',
  to: '',
  line: '',
  includeWebhooks: true,
});

export function filtersAreEmpty(f: Filters): boolean {
  return f.kinds.size === 0
    && f.stations.size === 0
    && f.from === ''
    && f.to === ''
    && f.line === ''
    && f.includeWebhooks;
}

/** Predicate used by the activity feed to apply a Filters set to a single event. */
export function matchesFilters(e: HistoryEntry, f: Filters): boolean {
  if (!f.includeWebhooks && e.station === 'webhook') return false;
  if (f.kinds.size > 0 && !f.kinds.has(e.kind)) return false;
  if (f.stations.size > 0 && !f.stations.has(e.station as StationKey)) return false;
  if (f.from) {
    const hay = (e.fromName ?? e.from).toLowerCase();
    if (!hay.includes(f.from.toLowerCase())) return false;
  }
  if (f.to && !e.to.toLowerCase().includes(f.to.toLowerCase())) return false;
  if (f.line && !e.line.toLowerCase().includes(f.line.toLowerCase())) return false;
  return true;
}

export function FilterSheet({
  visible,
  filters,
  onChange,
  onClose,
}: {
  visible: boolean;
  filters: Filters;
  onChange: (next: Filters) => void;
  onClose: () => void;
}): React.ReactElement {
  const scheme = useColorScheme();
  const dark = scheme === 'dark';
  const colors = {
    fg: dark ? '#e8ecf2' : '#1a1f29',
    sub: dark ? '#8a94a6' : '#5a6477',
    bg: dark ? '#161a22' : '#fafbfd',
    border: dark ? '#262c38' : '#e3e7ef',
    chipBg: dark ? '#1d2230' : '#eef1f7',
    chipBgOn: '#5aa9ff',
    chipFg: dark ? '#e8ecf2' : '#1a1f29',
    chipFgOn: '#ffffff',
    accent: '#5aa9ff',
    inputBg: dark ? '#0f1115' : '#ffffff',
  };

  const toggleKind = (k: HistoryKind): void => {
    const next = new Set(filters.kinds);
    if (next.has(k)) next.delete(k); else next.add(k);
    onChange({ ...filters, kinds: next });
  };
  const toggleStation = (s: StationKey): void => {
    const next = new Set(filters.stations);
    if (next.has(s)) next.delete(s); else next.add(s);
    onChange({ ...filters, stations: next });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}
      >
        <Pressable
          onPress={() => { /* swallow taps inside the sheet */ }}
          style={{
            backgroundColor: colors.bg,
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            maxHeight: '85%',
            paddingBottom: 24,
            borderTopWidth: 1,
            borderColor: colors.border,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 }}>
            <Text style={{ fontSize: 17, fontWeight: '700', color: colors.fg, flex: 1 }}>Filter events</Text>
            <Pressable onPress={() => onChange(emptyFilters())} hitSlop={8}>
              <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '600' }}>Reset</Text>
            </Pressable>
            <Pressable onPress={onClose} hitSlop={8}>
              <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '700' }}>Done</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16, gap: 16 }}>
            <Section label="Kind" colors={colors}>
              <ChipRow>
                {ALL_KINDS.map(k => (
                  <Chip key={k} label={k} on={filters.kinds.has(k)} onPress={() => toggleKind(k)} colors={colors} />
                ))}
              </ChipRow>
            </Section>
            <Section label="Station" colors={colors}>
              <ChipRow>
                {ALL_STATIONS.map(s => (
                  <StationChip key={s} station={s} on={filters.stations.has(s)} onPress={() => toggleStation(s)} colors={colors} />
                ))}
              </ChipRow>
            </Section>
            <Section label="From contains" colors={colors}>
              <TextInput
                value={filters.from}
                onChangeText={t => onChange({ ...filters, from: t })}
                placeholder="alice, @bot, metro://…"
                placeholderTextColor={colors.sub}
                style={inputStyle(colors)}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </Section>
            <Section label="To contains" colors={colors}>
              <TextInput
                value={filters.to}
                onChangeText={t => onChange({ ...filters, to: t })}
                placeholder="metro://discord/…"
                placeholderTextColor={colors.sub}
                style={inputStyle(colors)}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </Section>
            <Section label="Line contains" colors={colors}>
              <TextInput
                value={filters.line}
                onChangeText={t => onChange({ ...filters, line: t })}
                placeholder="channel id or name fragment"
                placeholderTextColor={colors.sub}
                style={inputStyle(colors)}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </Section>
            <Section label="Webhooks" colors={colors}>
              <ChipRow>
                <Chip
                  label={filters.includeWebhooks ? 'Included' : 'Hidden'}
                  on={filters.includeWebhooks}
                  onPress={() => onChange({ ...filters, includeWebhooks: !filters.includeWebhooks })}
                  colors={colors}
                />
              </ChipRow>
            </Section>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
