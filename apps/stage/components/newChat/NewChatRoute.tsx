import { Redirect, useLocalSearchParams } from 'expo-router';
import { newChatMetadata, newChatParams } from './newChatMetadata.model';
import { NewChatScreen } from './NewChatScreen';
import { useWebTabRail } from '../layout/webLayout';
import { useAccountEpoch } from '../../lib/accountEpoch';
import { useHomeViewLoaded } from '../../lib/homeView';
import { useBoardHome } from '../tabs/boardHome';
import { PAGES, newChatHref } from '../tabs/pages';

export function NewChatRoute(): React.ReactElement {
  const wide = useWebTabRail();
  const board = useBoardHome();
  const loaded = useHomeViewLoaded();
  const accountEpoch = useAccountEpoch();
  const params = newChatParams(newChatMetadata(useLocalSearchParams()));
  const href = newChatHref(wide, board);
  return loaded && href === PAGES.chats.href ? <Redirect href={{ pathname: href, params }} /> : <NewChatScreen key={accountEpoch} />;
}
