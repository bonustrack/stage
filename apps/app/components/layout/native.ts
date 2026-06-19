/** @file Sanctioned single re-export point for raw React Native View/Text/TextInput, the one location where the import ban on raw RN primitives is intentionally turned off. */
// Sanctioned raw-React-Native re-exports.
//
// The lint rules ban importing the raw RN primitives (View / Text / TextInput)
// directly from "react-native" in app/component code, to steer layout to the
// Kit primitives. A handful of call sites genuinely need the raw primitive
// (an inline <Text>-embeddable <View>, a bare <Text> that inherits its parent's
// typography, the app-wide TextInput.defaultProps target, or a measurement ref
// type). Rather than scatter eslint-disable comments, those call sites import
// the raw primitive from THIS module, which lives under components/layout/** —
// the one location the import ban is intentionally turned off (the Box/Row/Col
// primitives wrap View here). This keeps the escape hatch explicit, greppable
// and centralised, with zero eslint-disable directives in the codebase.
export { View, Text, TextInput } from 'react-native';
export type { View as ViewType } from 'react-native';
