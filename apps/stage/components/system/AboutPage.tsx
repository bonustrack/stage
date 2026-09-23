
import { usePalette } from '../../lib/theme';
import { SettingsPage } from '../settings/SettingsPage';
import { AboutPanel } from './AboutPanel';

export function AboutPage(): React.ReactElement {
  const { text: fg, link: head, border } = usePalette();

  return (
    <SettingsPage title="About">
      <AboutPanel head={head} sub={fg} border={border}/>
    </SettingsPage>
  );
}
