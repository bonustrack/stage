/** Settings -> Experimental -> "7702 spike" route. DEV-ONLY EIP-7702 + Kernel v3
 *  de-risk harness (see components/settings/Spike7702 + lib/smartAccount.spike). */

import { Spike7702 } from '../../components/settings/Spike7702';

export default function Spike7702Route(): React.ReactElement {
  return <Spike7702 />;
}
