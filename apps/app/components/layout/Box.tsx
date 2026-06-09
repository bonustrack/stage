/** Box / Row / Col - RN layout primitives.
 *
 *  The renderer was RELOCATED into @metro-labs/kit (`kit/src/box.tsx`) so Kit is
 *  the single import source for layout. This file is a thin re-export kept for
 *  back-compat: the ~60 app call sites that import `../layout` (which re-exports
 *  this) keep working unchanged. New code may import from `@metro-labs/kit/box`
 *  directly. */

export { Box, Row, Col } from '@metro-labs/kit/box';
export type { Align, Justify, BoxProps, RowColProps, Surface } from '@metro-labs/kit/box';
