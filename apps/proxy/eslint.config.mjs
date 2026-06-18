import tseslint from "typescript-eslint";
import { ignores, recommended, strictTsBlock } from "@stage-labs/config/eslint/base";

// Rules live in @stage-labs/config/eslint/base — the shared pure-TypeScript
// preset (ban `any` + cap files at 400 lines), unchanged.
export default tseslint.config(ignores(), ...recommended, strictTsBlock());
