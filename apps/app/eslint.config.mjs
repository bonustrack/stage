import tseslint from "typescript-eslint";
import { reactNative } from "@stage-labs/config/eslint/react-native";

// Rules live in @stage-labs/config/eslint/react-native (reactNative) — the
// theme-native warning + keyring guard + the View/Image/messaging import bans +
// the fontSize/layout/surface structural bans + max-lines + the .js CJS
// exemption, unchanged.
export default tseslint.config(...reactNative());
