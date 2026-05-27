/** @stage-labs/metro-client — framework-agnostic shared logic for the Metro
 *  clients (apps/ui Vue web + apps/app React Native). Pure TypeScript only:
 *  no Vue, no React, no react-native, no browser-only globals beyond `fetch`.
 *
 *  Subpath exports are also available (e.g. `@stage-labs/metro-client/profile`)
 *  for call-sites that want to keep imports narrow. */

export * from './types';
export * from './profile/snapshot';
export * from './xmtp/humanize';
export * from './embed/detect';
export * from './stamp/resolve';
