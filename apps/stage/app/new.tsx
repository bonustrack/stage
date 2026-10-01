import { Redirect } from 'expo-router';
import { NewChatScreen } from '../components/home/NewChatScreen';
import { useWebTabRail } from '../lib/webLayout';

export default function NewChatRoute(): React.ReactElement {
  const wide = useWebTabRail();
  return wide ? <Redirect href="/" /> : <NewChatScreen/>;
}
