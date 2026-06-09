/** @metro-labs/kit — shared design system primitives for the Metro
 *  clients. Because apps/ui is Vue and apps/app is React Native, there are no
 *  literal cross-framework components; what IS shareable is the framework-
 *  agnostic data behind them: colour/spacing tokens, HeroIcon path data,
 *  station icon definitions, and the theme-preference contract.
 *
 *  See README.md for the component-naming convention and the
 *  shareable-vs-framework-specific breakdown. */

export * from './tokens';
export * from './theme-derive';
export * from './icons';
export * from './theme';
export * from './theme-context';
export * from './avatar';
