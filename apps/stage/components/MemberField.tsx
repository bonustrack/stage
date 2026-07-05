
import { TextField } from '@stage-labs/kit/react-native/text-field';
import { useKitScheme } from '@stage-labs/kit/react-native/theme-context';

export interface MemberFieldProps {
  value: string;
  placeholder: string;
  color: string;
  placeholderColor: string;
  inputBg: string;
  border: string;
  radius: number;
  paddingX: number;
  paddingY: number;
  autoFocus?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?: boolean;
  returnKeyType?: 'done' | 'go' | 'next' | 'search' | 'send';
  onChangeText: (text: string) => void;
  onSubmit?: () => void;
}

export function MemberField(props: MemberFieldProps): React.ReactElement {
  const dark = useKitScheme() === 'dark';
  return (
    <TextField
      name="field"
      value={props.value}
      placeholder={props.placeholder}
      variant="outline"
      autoFocus={props.autoFocus}
      background={props.inputBg}
      borderColor={props.border}
      color={props.color}
      placeholderColor={props.placeholderColor}
      radius={props.radius}
      paddingX={props.paddingX}
      paddingY={props.paddingY}
      fontSize={15}
      fontFamily="Calibre-Medium"
      minHeight={0}
      autoCapitalize={props.autoCapitalize}
      autoCorrect={props.autoCorrect}
      returnKeyType={props.returnKeyType}
      dark={dark}
      onChangeText={props.onChangeText}
      onSubmit={props.onSubmit}
    />
  );
}
