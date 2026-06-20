/** @file Sanctioned single re-export point for raw React Native View/Text/TextInput — the one place the import ban on raw RN primitives is turned off, giving call sites that genuinely need a raw primitive an explicit, greppable, centralised escape hatch with zero eslint-disable directives. */
export { View, Text, TextInput } from 'react-native';
export type { View as ViewType } from 'react-native';
