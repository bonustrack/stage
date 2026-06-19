/**
 * @file Full-width flat search field that replaces the topnav while search is
 *  open, shared by the channels list and conversation view, with a back chevron
 *  to collapse and a trailing clear button.
 */

import { forwardRef } from 'react';
import { fontSize } from '@metro-labs/kit/tokens';
import { Pressable } from '@metro-labs/kit/pressable';
import { Icon } from '@metro-labs/kit/icon';
import { Input } from '@metro-labs/kit/input';
import { Row } from './layout';
import { TOPNAV_HEIGHT } from './Topnav';

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
  /** Optional extra top inset (e.g. status-bar height on the conversation view whose topnav extends under the status bar). Defaults to 0. */
  topInset?: number;
}>(function SearchTopnavBar(props, ref): React.ReactElement {
  const { head, sub } = props;
  const topInset = props.topInset ?? 0;
  return (
    <Row
      height={TOPNAV_HEIGHT + topInset}
      padding={{ x: 16, top: topInset }}
      align="center" gap={10} surface="toolbar"
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
        <Pressable onPress={() => { props.setQuery(''); }} hitSlop={8}>
          <Icon name="x" size={18} color={sub}/>
        </Pressable>
      ) : null}
    </Row>
  );
});
