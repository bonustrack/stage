import { Redirect } from 'expo-router';
import { settingsSection } from '../components/settings/settingsCatalog.model';

export default function ContactsRedirect(): React.ReactElement {
  return <Redirect href={settingsSection('contacts').href}/>;
}
