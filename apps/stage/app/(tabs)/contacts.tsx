import { Platform } from 'react-native';
import { ContactsScreen } from '../../components/ContactsScreen';

export default function ContactsRoute(): React.ReactElement | null {
  return Platform.OS === 'web' ? <ContactsScreen /> : null;
}
