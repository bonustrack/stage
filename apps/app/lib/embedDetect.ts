/**
 * @file Re-exports the shared embed-detection helpers (YouTube/map URL parsing, OSM tile URLs) so apps/app keeps its import path while the implementation lives in @stage-labs/client.
 */

export {
  youtubeIdOf, mapCoordsOf, osmTileUrl,
} from '@stage-labs/client/embed/detect';
