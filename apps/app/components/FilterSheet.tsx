/** Inline filter sheet — multi-select chips + free-text fields. Session-only state. */

import { Modal, Pressable, ScrollView, Text, TextInput, View, useColorScheme } from 'react-native';
import { StationIcon } from './StationIcon';
import { stationLabel } from '../../_shared/icons/stations';
import type { HistoryEntry } from '../lib/types';

export type StationKey = 'discord' | 'telegram' | 'webhook' | 'claude' | 'codex' | 'messenger';
const STATIONS: StationKey[] = ['discord', 'telegram', 'webhook', 'claude', 'codex', 'messenger'];

export interface Filters {
  stations: Set<StationKey>;
  from: string; to: string; line: string;
  includeWebhooks: boolean;
}

export const emptyFilters = (): Filters => ({
  stations: new Set(),
  from: '', to: '', line: '', includeWebhooks: true,
});

export function filtersAreEmpty(f: Filters): boolean {
  return f.stations.size === 0
    && f.from === '' && f.to === '' && f.line === '' && f.includeWebhooks;
}

/** Predicate used by the activity feed to apply a Filters set to a single event. */
export function matchesFilters(e: HistoryEntry, f: Filters): boolean {
  if (!f.includeWebhooks && e.station === 'webhook') return false;
  if (f.stations.size > 0 && !f.stations.has(e.station as StationKey)) return false;
  if (f.from && !(e.fromName ?? e.from).toLowerCase().includes(f.from.toLowerCase())) return false;
  if (f.to && !e.to.toLowerCase().includes(f.to.toLowerCase())) return false;
  if (f.line && !e.line.toLowerCase().includes(f.line.toLowerCase())) return false;
  return true;
}

export function FilterSheet({ visible, filters, onChange, onClose }: {
  visible: boolean; filters: Filters;
  onChange: (next: Filters) => void; onClose: () => void;
}): React.ReactElement {
  const dark = useColorScheme() === 'dark';
  const fg = dark ? '#e8ecf2' : '#1a1f29';
  const sub = dark ? '#8a94a6' : '#5a6477';
  const border = dark ? '#262c38' : '#e3e7ef';
  const chipBg = dark ? '#1d2230' : '#eef1f7';
  const inputBg = dark ? '#000000' : '#ffffff';
  const accent = '#ffffff';

  const toggle = (v: StationKey): void => {
    const next = new Set(filters.stations);
    if (next.has(v)) next.delete(v); else next.add(v);
    onChange({ ...filters, stations: next });
  };

  const chip = (label: string, on: boolean, onPress: () => void, station?: string): React.ReactElement => (
    <Pressable
      key={label}
      onPress={onPress}
      style={{
        paddingHorizontal: station ? 10 : 12, paddingVertical: 6, borderRadius: 14,
        backgroundColor: on ? accent : chipBg, borderWidth: 1,
        borderColor: on ? accent : border,
        flexDirection: 'row', alignItems: 'center', gap: 6,
      }}
    >
      {station ? <StationIcon station={station} /> : null}
      <Text style={{ color: on ? '#ffffff' : fg, fontSize: 13, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );

  const section = (label: string, children: React.ReactNode): React.ReactElement => (
    <View style={{ gap: 8 }}>
      <Text style={{ fontSize: 12, fontWeight: '600', color: sub, textTransform: 'uppercase' }}>{label}</Text>
      {children}
    </View>
  );

  const inputStyle = {
    backgroundColor: inputBg, color: fg, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: border, fontSize: 14,
  };

  const textField = (label: string, key: 'from' | 'to' | 'line', placeholder: string): React.ReactElement =>
    section(label, (
      <TextInput
        value={filters[key]}
        onChangeText={t => onChange({ ...filters, [key]: t })}
        placeholder={placeholder} placeholderTextColor={sub}
        style={inputStyle} autoCapitalize="none" autoCorrect={false}
      />
    ));

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
        <Pressable
          onPress={() => { /* swallow taps inside the sheet */ }}
          style={{
            backgroundColor: dark ? '#161a22' : '#fafbfd',
            borderTopLeftRadius: 16, borderTopRightRadius: 16,
            maxHeight: '85%', paddingBottom: 24, borderTopWidth: 1, borderColor: border,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 }}>
            <Text style={{ fontSize: 17, fontWeight: '700', color: fg, flex: 1 }}>Filter events</Text>
            <Pressable onPress={() => onChange(emptyFilters())} hitSlop={8}>
              <Text style={{ color: accent, fontSize: 13, fontWeight: '600' }}>Reset</Text>
            </Pressable>
            <Pressable onPress={onClose} hitSlop={8}>
              <Text style={{ color: accent, fontSize: 13, fontWeight: '700' }}>Done</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16, gap: 16 }}>
            {section('Station', (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {STATIONS.map(s => chip(stationLabel(s), filters.stations.has(s), () => toggle(s), s))}
              </View>
            ))}
            {textField('From contains', 'from', 'alice, @bot, metro://…')}
            {textField('To contains', 'to', 'metro://discord/…')}
            {textField('Line contains', 'line', 'channel id or name fragment')}
            {section('Webhooks', (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {chip(
                  filters.includeWebhooks ? 'Included' : 'Hidden',
                  filters.includeWebhooks,
                  () => onChange({ ...filters, includeWebhooks: !filters.includeWebhooks }),
                )}
              </View>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
