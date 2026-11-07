import { useRef, useState } from 'react';
import type { NativeSyntheticEvent, TextInputKeyPressEventData } from 'react-native';
import { SEARCH_INPUT_PROPS, type TextField, type TextFieldProps } from '@stage-labs/kit/react-native/text-field';

type InputNode = React.ComponentRef<typeof TextField>;

export interface SearchInputOptions {
  query: string;
  setQuery: (query: string) => void;
  onClose: () => void;
  blurOnEscape: boolean;
  focusColor: string;
  restColor: string;
  inputProps?: TextFieldProps['inputProps'];
}

export interface SearchInput {
  input: React.RefObject<InputNode | null>;
  inputRef: (node: InputNode | null) => void;
  clear: () => void;
  color: string;
  inputProps: TextFieldProps['inputProps'];
}

export function useSearchInput(o: SearchInputOptions, forwarded: React.ForwardedRef<InputNode>): SearchInput {
  const [focused, setFocused] = useState(false);
  const input = useRef<InputNode>(null);
  const inputRef = (node: InputNode | null): void => {
    input.current = node;
    if (typeof forwarded === 'function') forwarded(node);
    else if (forwarded !== null) forwarded.current = node;
  };
  const onKeyPress = (event: NativeSyntheticEvent<TextInputKeyPressEventData>): void => {
    SEARCH_INPUT_PROPS.onKeyPress?.(event);
    if (event.nativeEvent.key === 'Escape' && o.query === '') {
      if (o.blurOnEscape) input.current?.blur();
      o.onClose();
    } else o.inputProps?.onKeyPress?.(event);
  };
  return {
    input,
    inputRef,
    clear: () => {
      o.setQuery('');
      input.current?.focus();
    },
    color: focused ? o.focusColor : o.restColor,
    inputProps: {
      autoCapitalize: 'none',
      autoCorrect: false,
      returnKeyType: 'search',
      ...o.inputProps,
      ...SEARCH_INPUT_PROPS,
      onKeyPress,
      onFocus: (event) => {
        setFocused(true);
        o.inputProps?.onFocus?.(event);
      },
      onBlur: (event) => {
        setFocused(false);
        o.inputProps?.onBlur?.(event);
      },
    },
  };
}
