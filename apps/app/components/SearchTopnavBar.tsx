
import { forwardRef } from 'react';
import { fontSize } from '@stage-labs/kit/tokens';
import { Pressable } from '@stage-labs/kit/pressable';
import { Icon } from '@stage-labs/kit/icon';
import { Input } from '@stage-labs/kit/input';
import { Row } from './layout';
import { TOPNAV_HEIGHT } from './Topnav';

export const SearchTopnavBar = forwardRef<React.ComponentRef<typeof Input>, {
  query: string;
  setQuery: (v: string) => void;
  onClose: () => void;
  head: string;
  sub: string;
  border: string;
  placeholder?: string;
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
