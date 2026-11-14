import { LegalPage } from '../components/legal/LegalPage';
import { TERMS } from '../components/legal/terms.model';

export default function TermsRoute(): React.ReactElement {
  return <LegalPage doc={TERMS} />;
}
