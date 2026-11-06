import { SettingsMenu } from '../../components/settings/SettingsHub';
import { renderedByRoute } from '../../components/tabs/pageRenderer';

export default function SettingsRoute(): React.ReactElement | null {
  return renderedByRoute('settings') ? <SettingsMenu /> : null;
}
