import { ContactsScreen } from '../../components/contacts/ContactsScreen';
import { renderedByRoute } from '../../components/tabs/pageRenderer';

export default function ContactsRoute(): React.ReactElement | null {
  return renderedByRoute('contacts') ? <ContactsScreen /> : null;
}
