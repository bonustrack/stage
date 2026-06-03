/** Shared SwipeTabs types — leaf module with no component imports.
 *
 *  Lives apart from SwipeTabs.config.tsx (which imports every tab component) so
 *  tab screens can import `SimultaneousRefs` without forming a cycle back into
 *  the config/pager. */

import type { GestureType } from 'react-native-gesture-handler';

export type SimultaneousRefs = React.RefObject<GestureType | undefined>;
