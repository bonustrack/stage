// Single root ESLint flat config for the whole Stage monorepo.
//
// All rules live in @stage-labs/config. `monorepo()` composes the per-workspace
// presets (react-native for apps/app + packages/kit, base/strict-TS for
// apps/proxy + packages/client, vue for apps/ui) into one flat-config
// array with each preset scoped by workspace directory, so a single `eslint .`
// from the repo root reproduces exactly what the former per-workspace
// configs produced. The Vue preset (and its parser/plugin) is loaded lazily
// inside `monorepo()` and never touches the React Native path.
import { monorepo } from "@stage-labs/config/eslint/monorepo";

export default await monorepo();
