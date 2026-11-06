import { Redirect, useLocalSearchParams } from 'expo-router';
import { newChatMetadata, newChatParams } from '../components/newChat/newChatMetadata.model';
import { NewChatScreen } from '../components/newChat/NewChatScreen';
import { useWebTabRail } from '../components/layout/webLayout';
import { useAccountEpoch } from '../lib/accountEpoch';
import { useHomeViewLoaded } from '../lib/homeView';
import { useBoardHome } from '../components/tabs/boardHome';
import { PAGES, newChatHref } from '../components/tabs/pages';

export default function NewChatRoute(): React.ReactElement {
  const wide = useWebTabRail();
  const board = useBoardHome();
  const loaded = useHomeViewLoaded();
  const accountEpoch = useAccountEpoch();
  const params = newChatParams(newChatMetadata(useLocalSearchParams()));
  const href = newChatHref(wide, board);
  return loaded && href === PAGES.chats.href ? <Redirect href={{ pathname: href, params }} /> : <NewChatScreen key={accountEpoch} />;
}
