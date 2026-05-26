/** Re-export of the shared embed-detection helpers so call sites in apps/app
 *  keep their existing import path while the implementation lives under
 *  apps/_shared/embed for cross-platform reuse. */

export {
  youtubeIdOf, mapCoordsOf, osmTileXY, osmTileUrl,
  type MapCoords,
} from '../../_shared/embed/detect';
