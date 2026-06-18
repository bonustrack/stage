/** Re-export of the shared embed-detection helpers so call sites in apps/ui
 *  keep their existing import path while the implementation lives in
 *  @stage-labs/client for cross-platform reuse. */

export {
  youtubeIdOf, mapCoordsOf, osmTileUrl,
} from '@stage-labs/client/embed/detect';
