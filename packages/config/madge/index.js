// @stage-labs/config — shared madge preset for the Stage monorepo.
//
// Madge detects circular dependencies. This preset centralises the madge options
// (the file extensions to scan + TypeScript-aware detective options) so the root
// `madge` script just points madge at the source roots with `--circular` and
// `--config madge.config.cjs`. It is a REPORTING tool: the root script surfaces
// any cycles it finds but does not fail the build on pre-existing ones.
//
// Consumed from the repo root via a CommonJS shim (madge loads --config with
// require()):  module.exports = require("@stage-labs/config/madge").madgeConfig;

/** Shared madge options for the monorepo's TypeScript/TSX sources. */
const madgeConfig = {
  fileExtensions: ["ts", "tsx"],
  // Generated / vendored trees are never part of the dependency-cycle analysis.
  excludeRegExp: ["node_modules", "/dist/", "\\.d\\.ts$"],
};

export { madgeConfig };
export default madgeConfig;
