
import { Pressable } from '@stage-labs/kit/pressable';
import { Box } from './layout';
import { usePalette, useBlockRadius } from '../lib/theme';

interface Props {
  dark: boolean;
  onPress?: () => void;
  width?: number;
  children: React.ReactNode;
}

export function MediaCard({ onPress, width, children }: Props): React.ReactElement {
  const border = usePalette().border;
  const bg = border;
  const blockRadius = useBlockRadius();
  const style = {
    width: width ?? undefined,
    maxWidth: 280,
    borderRadius: blockRadius,
    borderWidth: 1,
    borderColor: border,
    backgroundColor: bg,
    overflow: 'hidden' as const,
    marginBottom: 6,
  };
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [style, { opacity: pressed ? 0.85 : 1 }]}
      >
        {children}
      </Pressable>
    );
  }
  return <Box style={style}>{children}</Box>;
}
