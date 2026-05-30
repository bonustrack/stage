/** Layout primitives — flex Box and its direction-locked Row/Col wrappers.
 *  Prop API mirrors the React Native primitives in apps/app. */
export { default as Box } from './Box.vue';
export { default as Row } from './Row.vue';
export { default as Col } from './Col.vue';
export { boxStyleEntries, boxInlineStyle } from './boxStyle';
export type {
  BoxProps,
  Direction,
  Align,
  Justify,
} from './boxStyle';
