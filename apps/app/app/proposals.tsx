/** `/proposals` route - a pushed/stacked page (opened from the Home banner) that
 *  hosts the ProposalsScreen body with its own back-header topnav. Not a tab: the
 *  Proposals entry was removed from the footer; this opens like Menu / Settings.
 *  Deep links to metro://.../proposals resolve here. */

import { ProposalsScreen } from '../components/tabs/ProposalsScreen';

export default function ProposalsRoute(): React.ReactElement {
  return <ProposalsScreen/>;
}
