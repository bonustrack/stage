/** SearchTopnavBar — the full-width search field that fully REPLACES a topnav
 *  while search is open (the parent hides its own topnav entirely and renders
 *  this in its place). A back chevron on the left collapses search (via
 *  onClose); the query sits on a FLAT toolbar surface — no inset field, no
 *  background, no pill/radius — just a leading search glyph, the text/placeholder
 *  and a trailing clear button. Autofocuses on mount (the parent only renders it
 *  while search is open). Shared by Home (channels list) and the conversation
 *  view so both use the exact same bar, sized to match the topnav it stands in
 *  for. */

import { forwardRef } from 'react';
import { fontSize } from '@metro-labs/kit/tokens';
import { Pressable } from '@metro-labs/kit/pressable';
import { Icon } from '@metro-labs/kit/icon';
import { Input } from '@metro-labs/kit/input';
import { Row } from './layout';

export const SearchTopnavBar = forwardRef<React.ComponentRef<typeof Input>, {
  query: string;
  setQuery: (v: string) => void;
  onClose: () => void;
  head: string;
  sub: string;
  /** Hairline bottom-border colour — mirrors the topnav's separator. */
  border: string;
  /** Placeholder text — defaults to "Search". */
  placeholder?: string;
  /** Optional extra top inset (e.g. status-bar height on the conversation view
   *  whose topnav extends under the status bar). Defaults to 0. */
  topInset?: number;
  /** Fixed content height (below topInset) when the topnav it replaces uses a
   *  fixed height (the conversation view's 52px bar). Omitted → the bar matches
   *  the main-tab Topnav's padding-driven height instead. */
  height?: number;
}>(function SearchTopnavBar(props, ref): React.ReactElement {
  const { head, sub } = props;
  const topInset = props.topInset ?? 0;
  // Match the topnav being replaced: either a fixed content height (conversation
  // view) or the main-tab Topnav padding (x:16, top:12, bottom:10).
  const layout = props.height != null
    ? { height: props.height + topInset, padding: { x: 16, top: topInset } as const }
    : { padding: { x: 16, top: 12 + topInset, bottom: 10 } as const };
  return (
    <Row {...layout} align="center" gap={10} surface="toolbar"
      style={{ borderBottomWidth: 1, borderBottomColor: props.border }}>
      <Pressable onPress={props.onClose} hitSlop={8}>
        <Icon name="arrowLeft" size={22} color={head}/>
      </Pressable>
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
          <Icon name="x" size={18} color={sub}/>
        </Pressable>
      ) : null}
    </Row>
  );
});
