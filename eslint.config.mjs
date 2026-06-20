/** @file Root ESLint flat config; composes per-workspace presets from @stage-labs/config via monorepo(). */
import { monorepo } from "@stage-labs/config/eslint/monorepo";

export default await monorepo();
