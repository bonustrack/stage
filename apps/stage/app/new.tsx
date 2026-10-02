import { Redirect } from 'expo-router';
import { NewChatScreen } from '../components/home/NewChatScreen';
import { useWebTabRail } from '../lib/webLayout';
import { useAccountEpoch } from '../lib/accountEpoch';

export default function NewChatRoute(): React.ReactElement {
  const wide = useWebTabRail();
  const accountEpoch = useAccountEpoch();
  return wide ? <Redirect href="/" /> : <NewChatScreen key={accountEpoch}/>;
}
