// Root madge runner — uses the shared @stage-labs/config/madge preset as the
// single source of truth for scan options (madge's CLI has no generic --config
// flag, and .madgerc is JSON-only, so we drive the programmatic API instead).
//
// Reports circular dependencies across the monorepo source roots. REPORTING
// only: it prints what it finds and exits non-zero if cycles exist, but the
// `report:deps` script swallows that so pre-existing findings never fail a build.
import madge from "madge";
import { madgeConfig } from "@stage-labs/config/madge";

const ROOTS = [
  "apps/app/app",
  "apps/app/components",
  "apps/app/lib",
  "apps/app/modules",
  "packages/client/src",
  "packages/kit/src",
  // apps/ui (Vue SFCs) is intentionally excluded: madge's detective can't parse
  // .vue single-file components, and the original madge script never scanned it.
];

const res = await madge(ROOTS, madgeConfig);
const circular = res.circular();

if (circular.length === 0) {
  console.log("madge: no circular dependencies found across", ROOTS.length, "source roots.");
  process.exit(0);
}

console.log(`madge: ${circular.length} circular dependenc${circular.length === 1 ? "y" : "ies"} found:\n`);
for (const cycle of circular) console.log("  " + cycle.join(" → "));
process.exit(1);
