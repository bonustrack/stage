/** @file Re-export of the shared YouTube/map embed-detection helpers from @stage-labs/client so apps/ui call sites keep their existing import path. */

export {
  youtubeIdOf, mapCoordsOf, osmTileUrl,
} from '@stage-labs/client/embed/detect';
