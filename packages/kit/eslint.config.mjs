import tseslint from "typescript-eslint";
import { kitEslint } from "@stage-labs/config/eslint/react-native";

// Rules live in @stage-labs/config/eslint/react-native (kitEslint) — the Kit
// layout structural bans + token-discipline blocks, unchanged.
export default tseslint.config(...kitEslint());
