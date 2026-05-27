/** Re-export of the shared embed-detection helpers so call sites in apps/app
 *  keep their existing import path while the implementation lives in
 *  @metro-labs/client for cross-platform reuse. */

export {
  youtubeIdOf, mapCoordsOf, osmTileXY, osmTileUrl,
  type MapCoords,
} from '@metro-labs/client/embed/detect';
