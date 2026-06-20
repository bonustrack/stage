/** @file Leaf module of shared SwipeTabs types (SimultaneousRefs), kept free of component imports so tab screens import it without cycling into the config. */

import type { GestureType } from 'react-native-gesture-handler';

export type SimultaneousRefs = React.RefObject<GestureType | undefined>;
