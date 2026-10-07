import type { GroupKey } from '@stage-labs/client/xmtp/readState';
import { IconPlusLarge } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconPlusLarge';
import { HoverIconButton } from '../hover';
import { usePalette } from '../../lib/theme';
import { useOpenNewChat } from './newChatFocus';
import { groupedChatMetadata } from './newChatMetadata.model';

export function NewChatAction({ by, groupKey, title }: { by: GroupKey; groupKey: string; title: string }): React.ReactElement {
  const { sub } = usePalette();
  const open = useOpenNewChat(groupedChatMetadata(by, groupKey, title));
  return (
    <HoverIconButton icon={IconPlusLarge} size={16} color={sub} role="button" label={`New chat in ${title}`} placement="below"
      onPress={(event) => { event.stopPropagation(); open(); }}/>
  );
}
