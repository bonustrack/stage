import { Redirect } from 'expo-router';
import { NewChatScreen } from '../components/home/NewChatScreen';
import { useWebTabRail } from '../lib/webLayout';
import { useActiveAccount } from '../modules/messaging';

export default function NewChatRoute(): React.ReactElement {
  const wide = useWebTabRail();
  const accountEpoch = useActiveAccount();
  return wide ? <Redirect href="/" /> : <NewChatScreen key={accountEpoch}/>;
}
