import { Redirect, useLocalSearchParams } from 'expo-router';
import { newChatMetadata, newChatParams } from '../components/home/newChatMetadata.model';
import { NewChatScreen } from '../components/home/NewChatScreen';
import { useWebTabRail } from '../lib/webLayout';
import { useAccountEpoch } from '../lib/accountEpoch';
import { useHomeViewLoaded } from '../lib/homeView';
import { useBoardHome } from '../components/tabs/boardHome';

export default function NewChatRoute(): React.ReactElement {
  const wide = useWebTabRail();
  const board = useBoardHome();
  const loaded = useHomeViewLoaded();
  const accountEpoch = useAccountEpoch();
  const params = newChatParams(newChatMetadata(useLocalSearchParams()));
  return wide && loaded && !board ? <Redirect href={{ pathname: '/', params }} /> : <NewChatScreen key={accountEpoch}/>;
}
