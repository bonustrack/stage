import { LegalPage } from '../components/legal/LegalPage';
import { PRIVACY } from '../components/legal/privacy.model';

export default function PrivacyRoute(): React.ReactElement {
  return <LegalPage doc={PRIVACY} />;
}
