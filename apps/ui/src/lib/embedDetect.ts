/** Re-export of the shared embed-detection helpers so call sites in apps/ui
 *  keep their existing import path while the implementation lives in
 *  @stage-labs/metro-client for cross-platform reuse. */

export {
  youtubeIdOf, mapCoordsOf, osmTileXY, osmTileUrl,
  type MapCoords,
} from '@stage-labs/metro-client/embed/detect';
