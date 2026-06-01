/** System route — Kit component gallery + About page. Reached only from the
 *  LeftDrawer's "System" row (a top-level pushed route, like /accounts). */

import { SystemScreen } from '../components/system/SystemScreen';

export default function SystemRoute(): React.ReactElement {
  return <SystemScreen />;
}
