/** System route — a settings-style menu (Kit, About) reached from the
 *  LeftDrawer's "System" row. Each row pushes its own sub-page. */

import { SystemScreen } from '../../components/system/SystemScreen';

export default function SystemRoute(): React.ReactElement {
  return <SystemScreen />;
}
