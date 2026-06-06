/** @metro-labs/client — framework-agnostic shared logic for the Metro
 *  clients (apps/ui Vue web + apps/app React Native). Pure TypeScript only:
 *  no Vue, no React, no react-native, no browser-only globals beyond `fetch`.
 *
 *  Subpath exports are also available (e.g. `@metro-labs/client/profile`)
 *  for call-sites that want to keep imports narrow. */

export * from './types';
export * from './profile/snapshot';
export * from './xmtp/humanize';
export * from './xmtp/poll';
export * from './embed/detect';
export * from './stamp/resolve';

// Stage SDK: typed `createStageClient` factory + dependency-inversion
// interfaces. Pure TypeScript, zero react-native / expo. See ./stage.
export * from './api';
export * from './stage';
