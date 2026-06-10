/** SearchTopnavBar — the expanding full-width search field that overlays a
 *  topnav. A back chevron on the left collapses search (via onClose); an inset
 *  `raised` field holds the query with a leading search glyph + trailing clear
 *  button. Autofocuses on mount (the parent only renders it while search is
 *  open). Shared by Home (channels list) and the conversation view so both use
 *  the exact same search-icon-expands-to-topnav-input pattern. */

import { forwardRef } from 'react';
import { fontSize } from '@metro-labs/kit/tokens';
import { Pressable } from '@metro-labs/kit/pressable';
import { Icon } from '@metro-labs/kit/icon';
import { Input } from '@metro-labs/kit/input';
import { Row } from './layout';
import { useBlockRadius } from '../lib/theme';

export const SearchTopnavBar = forwardRef<React.ComponentRef<typeof Input>, {
  query: string;
  setQuery: (v: string) => void;
  onClose: () => void;
  head: string;
  sub: string;
  /** Placeholder text — defaults to "Search". */
  placeholder?: string;
  /** Optional extra top inset (e.g. status-bar height on the conversation view
   *  whose topnav extends under the status bar). Defaults to 0. */
  topInset?: number;
}>(function SearchTopnavBar(props, ref): React.ReactElement {
  const { head, sub } = props;
  const blockRadius = useBlockRadius();
  return (
    <Row padding={{ x: 12, top: 12 + (props.topInset ?? 0), bottom: 10 }} align="center" gap={8} surface="toolbar">
      <Pressable onPress={props.onClose} hitSlop={8}>
        <Icon name="arrowLeft" size={22} color={head}/>
      </Pressable>
      <Row surface="raised" radius={blockRadius} padding={{ x: 14, y: 8 }} flex={1} align="center" gap={8}>
        <Icon name="search" size={22} color={sub}/>
        <Input
          ref={ref}
          autoFocus
          value={props.query}
          onChangeText={props.setQuery}
          placeholder={props.placeholder ?? 'Search'}
          placeholderTextColor={sub}
          inputProps={{ autoCapitalize: 'none', autoCorrect: false, returnKeyType: 'search' }}
          style={{ flex: 1, color: head, fontSize: fontSize('4xl'), lineHeight: 23, fontFamily: 'Calibre-Medium', padding: 0,
            backgroundColor: 'transparent', minHeight: 0, borderWidth: 0 }}
/>
        {props.query.length> 0 ? (
          <Pressable onPress={() => props.setQuery('')} hitSlop={8}>
            <Icon name="x" size={16} color={sub}/>
          </Pressable>
        ) : null}
      </Row>
    </Row>
  );
});
