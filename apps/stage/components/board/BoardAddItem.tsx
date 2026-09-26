import { useEffect, useMemo, useRef, useState, type ComponentRef, type RefObject } from 'react';
import { Button } from '@stage-labs/kit/react-native/button';
import { Glyph } from '@stage-labs/kit/react-native/glyph';
import type { Input } from '@stage-labs/kit/react-native/input';
import { MODAL } from '@stage-labs/kit/react-native/modal';
import { Text } from '@stage-labs/kit/react-native/text';
import { isRowCleared } from '@stage-labs/client/xmtp/readState';
import { IconPlusLarge } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconPlusLarge';
import { AppModal } from '../AppModal';
import { ChannelRow } from '../ChannelRow';
import { FormField } from '../FormField';
import { SuggestionCheck } from '../group/ContactSuggestions';
import { rowAvatarAddress, rowTitle } from '../home/parts';
import type { Row as ChannelRowData } from '../home/model';
import { useHover } from '../hover';
import { Box, Col } from '../layout';
import { useClearedChats } from '../../lib/clearedChats';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { addItemRows } from './BoardScreen.model';
import { COLUMN_PADDING } from './BoardColumnEdit';

export function AddItemButton({ onPress }: { onPress: () => void }): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const { text, link } = usePalette();
  const hover = useHover();
  const color = hover.hovered ? link : text;
  return (
    <Box padding={{ right: COLUMN_PADDING }}>
      <Button
        fullWidth size="md" color="secondary" variant="outline" dark={dark}
        label="Add item" tintFg={color} style={hover.hovered ? { borderColor: link } : undefined}
        iconStart={<Glyph icon={IconPlusLarge} size={18} color={color}/>}
        onPress={onPress}
        {...hover.hoverProps}
      />
    </Box>
  );
}

function ChannelChoice({ item, picked, query, onToggle }: {
  item: ChannelRowData; picked: boolean; query: string; onToggle: (convId: string) => void;
}): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const { link } = usePalette();
  return (
    <ChannelRow
      title={rowTitle(item)}
      avatarUri={item.avatarUri}
      avatarAddress={rowAvatarAddress(item, true)}
      square
      labels={item.labels}
      highlightQuery={query}
      onPress={() => { onToggle(item.convId); }}
      accessory={<SuggestionCheck selected={picked} checkBackground={link} dark={dark}/>}
    />
  );
}

function useFocusOnOpen(): RefObject<ComponentRef<typeof Input> | null> {
  const ref = useRef<ComponentRef<typeof Input>>(null);
  useEffect(() => {
    const timer = setTimeout(() => { ref.current?.focus(); }, 0);
    return () => { clearTimeout(timer); };
  }, []);
  return ref;
}

function AddItemForm({ label, rows, onAdd }: {
  label: string; rows: readonly ChannelRowData[]; onAdd: (convIds: string[]) => void;
}): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const { primary, bg } = usePalette();
  const cleared = useClearedChats();
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const input = useFocusOnOpen();
  const shown = useMemo(
    () => addItemRows(rows.filter(r => !isRowCleared(cleared, r)), label, query, picked),
    [rows, cleared, label, query, picked],
  );
  const toggle = (convId: string): void => {
    setPicked(prev => (prev.includes(convId) ? prev.filter(id => id !== convId) : [...prev, convId]));
  };
  return (
    <Col gap={16}>
      <FormField label="Search" placeholder="Channel name" value={query} onChangeText={setQuery} inputRef={input}
        inputProps={{ autoFocus: true, autoCapitalize: 'none', autoCorrect: false }}/>
      {shown.length === 0 ? <Text value="No channels found." size="sm" role="secondary"/> : (
        <Box margin={{ x: -MODAL.padding }}>
          {shown.map(item => (
            <ChannelChoice key={item.convId} item={item} picked={picked.includes(item.convId)} query={query} onToggle={toggle}/>
          ))}
        </Box>
      )}
      <Button size="lg" fullWidth dark={dark} disabled={picked.length === 0} tintBg={primary} tintFg={bg}
        label={picked.length > 0 ? `Add (${picked.length})` : 'Add'} onPress={() => { onAdd(picked); }}/>
    </Col>
  );
}

export function AddItemModal({ label, rows, onClose, onAdd }: {
  label: string | null; rows: readonly ChannelRowData[]; onClose: () => void; onAdd: (convIds: string[]) => void;
}): React.ReactElement {
  return (
    <AppModal visible={label !== null} onClose={onClose} title={label === null ? undefined : `Add to ${label}`}>
      {label === null ? null : <AddItemForm label={label} rows={rows} onAdd={onAdd}/>}
    </AppModal>
  );
}
