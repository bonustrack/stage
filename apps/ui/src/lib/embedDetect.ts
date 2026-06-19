/**
 * @file Re-export of the shared YouTube/map embed-detection helpers from @stage-labs/client.
 */
/** Re-export of the shared embed-detection helpers so call sites in apps/ui keep their existing import path while the implementation lives in @stage-labs/client for cross-platform reuse. */

export {
  youtubeIdOf, mapCoordsOf, osmTileUrl,
} from '@stage-labs/client/embed/detect';
