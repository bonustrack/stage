/** @file Shared madge preset for the Stage monorepo, centralising the file extensions and TypeScript-aware detective options for the BLOCKING CI circular-dependency check. */

/** Shared madge options for the monorepo's TypeScript/TSX sources. */
const madgeConfig = {
  fileExtensions: ["ts", "tsx"],
  /** Generated / vendored trees are never part of the dependency-cycle analysis. */
  excludeRegExp: ["node_modules", "/dist/", "\\.d\\.ts$"],
  /** Skip lazy `await import()` calls as intentional cycle breakers (mirrors the repo-root .madgerc); genuine static import cycles still fail the build. */
  detectiveOptions: {
    ts: { skipAsyncImports: true },
    tsx: { skipAsyncImports: true },
    es6: { skipAsyncImports: true },
  },
};

export { madgeConfig };
export default madgeConfig;
