import { Redirect } from 'expo-router';
import { NewChatScreen } from '../components/home/NewChatScreen';
import { useWebTabRail } from '../lib/webLayout';
import { useAccountEpoch } from '../lib/accountEpoch';
import { useHomeView, useHomeViewLoaded } from '../lib/homeView';

export default function NewChatRoute(): React.ReactElement {
  const wide = useWebTabRail();
  const board = useHomeView().view === 'board';
  const loaded = useHomeViewLoaded();
  const accountEpoch = useAccountEpoch();
  return wide && loaded && !board ? <Redirect href="/" /> : <NewChatScreen key={accountEpoch}/>;
}
