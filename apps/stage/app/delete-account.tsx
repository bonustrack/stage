import { LegalPage } from '../components/legal/LegalPage';
import { ACCOUNT_DELETION } from '../components/legal/deletion.model';

export default function DeleteAccountRoute(): React.ReactElement {
  return <LegalPage doc={ACCOUNT_DELETION} />;
}
