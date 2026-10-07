import { Redirect, useLocalSearchParams } from 'expo-router';
import { newChatMetadata, newChatParams } from '../components/home/newChatMetadata.model';
import { NewChatScreen } from '../components/home/NewChatScreen';
import { useWebTabRail } from '../lib/webLayout';
import { useAccountEpoch } from '../lib/accountEpoch';
import { useHomeView, useHomeViewLoaded } from '../lib/homeView';

export default function NewChatRoute(): React.ReactElement {
  const wide = useWebTabRail();
  const board = useHomeView().view === 'board';
  const loaded = useHomeViewLoaded();
  const accountEpoch = useAccountEpoch();
  const params = newChatParams(newChatMetadata(useLocalSearchParams()));
  return wide && loaded && !board ? <Redirect href={{ pathname: '/', params }} /> : <NewChatScreen key={accountEpoch}/>;
}
