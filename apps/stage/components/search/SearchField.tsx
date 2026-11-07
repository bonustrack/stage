import { Fragment, forwardRef } from 'react';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Glyph } from '@stage-labs/kit/react-native/glyph';
import type { TextField, TextFieldProps } from '@stage-labs/kit/react-native/text-field';
import { IconCrossMedium } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconCrossMedium';
import { IconMagnifyingGlass } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconMagnifyingGlass';
import { FORM_FIELD_HEIGHT, FormField } from '../FormField';
import { HoverTooltip } from '../HoverTooltip';
import { useShortcut } from '../keys/keys';
import { usePalette } from '../../lib/theme';
import { useSearchInput } from './searchInput';
import { Column, Row, STICKY_UNDER_CHROME, PAGE_GUTTER } from '../layout';

const FIELD_GAP = 4;
const SEARCH_FIELD_HEIGHT = FORM_FIELD_HEIGHT + FIELD_GAP;

export function StickyFrame({ children }: { children: React.ReactNode }): React.ReactElement {
  return <Column style={STICKY_UNDER_CHROME}>{children}</Column>;
}

function fieldActions(
  query: string,
  clear: () => void,
  color: string,
  action: React.ReactNode,
): { trailing?: React.ReactNode; trailingWidth?: number } {
  if (query === '' && action === undefined) return {};
  return {
    trailingWidth: query !== '' && action !== undefined ? 54 : 24,
    trailing: (
      <Row align="center" gap={16}>
        {query === '' ? null : (
          <Pressable onPress={clear} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear search">
            <Glyph icon={IconCrossMedium} size={18} color={color} />
          </Pressable>
        )}
        {action}
      </Row>
    ),
  };
}

export interface SearchFieldProps {
  query: string;
  setQuery: (query: string) => void;
  onClose: () => void;
  placeholder?: string;
  inline?: boolean;
  muted?: 'text' | 'sub';
  onOpen?: () => void;
  autoFocus?: boolean;
  fieldAction?: React.ReactNode;
  inputProps?: TextFieldProps['inputProps'];
}

export const SearchField = forwardRef<React.ComponentRef<typeof TextField>, SearchFieldProps>(function SearchField(props, ref) {
  const palette = usePalette();
  const muted = palette[props.muted ?? 'text'];
  const search = useSearchInput({ ...props, blurOnEscape: true, focusColor: palette.link, restColor: muted }, ref);
  const Frame = props.inline === true ? Fragment : StickyFrame;
  const shortcutNode = useShortcut('/', props.onOpen);
  return (
    <Frame>
      <Row height={SEARCH_FIELD_HEIGHT} padding={{ x: PAGE_GUTTER, bottom: FIELD_GAP }} surface="toolbar" align="center">
        <Column weight={1}>
          <FormField
            inputRef={search.inputRef}
            autoFocus={props.autoFocus ?? false}
            value={props.query}
            onChangeText={props.setQuery}
            placeholder={props.placeholder ?? 'Search'}
            inputProps={{ accessibilityLabel: 'Search', ...search.inputProps }}
            leading={
              <HoverTooltip label="Search" placement="below" shortcut="/" nodeRef={shortcutNode}>
                <Glyph icon={IconMagnifyingGlass} size={20} color={search.color} />
              </HoverTooltip>
            }
            {...fieldActions(props.query, search.clear, muted, props.fieldAction)}
          />
        </Column>
      </Row>
    </Frame>
  );
});
