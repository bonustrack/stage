import type { GroupKey } from '@stage-labs/client/xmtp/readState';
import { IconPlusLarge } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconPlusLarge';
import { HoverIconButton } from '../hover';
import { usePalette } from '../../lib/theme';
import { useOpenNewChat } from './newChatFocus';
import { setNewChatProject } from './newChatDefaults';
import { groupedChatMetadata } from './newChatMetadata.model';

export function NewChatAction({ by, groupKey, title }: { by: GroupKey; groupKey: string; title: string }): React.ReactElement {
  const { sub } = usePalette();
  const metadata = groupedChatMetadata(by, groupKey, title);
  const open = useOpenNewChat(metadata);
  return (
    <HoverIconButton icon={IconPlusLarge} size={16} color={sub} role="button" label={`New chat in ${title}`} placement="below"
      onPress={(event) => {
        event.stopPropagation();
        if (by === 'category') setNewChatProject(metadata.category);
        open();
      }}/>
  );
}
