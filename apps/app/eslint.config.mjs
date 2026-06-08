import tseslint from "typescript-eslint";

export default tseslint.config(
  // nodejs-assets/ is the embedded-Node host (runs inside nodejs-mobile, not
  // Hermes). It's node-only JS with its own runtime/globals + an N-API prover;
  // it is excluded from the Metro bundle (see metro.config.js) and built into
  // the native binary separately, so the app's TS/RN lint rules don't apply.
  { ignores: ["node_modules/**", ".expo/**", "dist/**", "nodejs-assets/**"] },
  ...tseslint.configs.recommended,
  {
    files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}"],
    rules: {
      // Strong typing: ban `any`. Use `unknown` + narrowing, real interfaces,
      // generics, or library types instead.
      "@typescript-eslint/no-explicit-any": "error",
      // Size tokens: forbid raw numeric `fontSize` in StyleSheet/inline styles.
      // Text sizing must come from the named Kit size scale (the Text `size`
      // prop, e.g. size="sm", or `fontSize('md')` / FONT_SIZE.md from
      // '@metro-labs/kit/tokens'), not magic px numbers, so the whole UI scales
      // in lock-step. ERROR: the full backlog (~364 sites) has been migrated to
      // the named scale, so raw numeric fontSize is hard-banned.
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "Property[key.name='fontSize'] > Literal[value=type(number)]",
          message:
            "use a named Kit size token (Text size=\"sm|md|lg|...\" prop, or fontSize('md')/FONT_SIZE.md from '@metro-labs/kit/tokens') instead of a raw fontSize number.",
        },
      ],
      // `error`: cap files at 400 lines. Split a file rather than crossing it.
      "max-lines": ["error", { max: 400, skipBlankLines: false, skipComments: false }],
      /** React Native bundles assets via require() — exempt. */
      "@typescript-eslint/no-require-imports": "off",
      // Steer layout containers to the Box/Row/Col primitives instead of raw View.
      // Only `View` is restricted — ScrollView, Pressable, Animated.View, etc. are fine.
      // `error`: all holdouts have been migrated to Box/Row/Col. Where a raw View
      // is genuinely required (onLayout/ref measurement, overlays, MaskedView
      // children, etc.), add a targeted
      // `// eslint-disable-next-line no-restricted-imports` at the import site.
      // ERROR: raw RN primitives that have a Kit equivalent AND are fully
      // migrated in apps/app. View -> Box/Row/Col; Image -> @metro-labs/kit/image.
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "react-native",
              importNames: ["View"],
              message:
                "Use Box/Row/Col from '@/components/layout' instead of View for layout containers.",
            },
            {
              name: "react-native",
              importNames: ["Image"],
              message:
                "Import Image from '@metro-labs/kit/image' instead of react-native.",
            },
            {
              name: "react-native",
              importNames: ["TextInput"],
              message:
                "Use Input/Textarea from '@metro-labs/kit/input' | '@metro-labs/kit/textarea' instead of react-native TextInput.",
            },
            {
              name: "react-native",
              importNames: ["ScrollView"],
              message:
                "Use Scroll from '@metro-labs/kit/scroll' instead of react-native ScrollView.",
            },
            {
              name: "react-native",
              importNames: ["Pressable"],
              message:
                "Use Pressable from '@metro-labs/kit/pressable' (or Kit Button) instead of react-native Pressable.",
            },
            {
              name: "react-native",
              importNames: ["FlatList"],
              message:
                "Use FlatList from '@metro-labs/kit/flat-list' instead of react-native FlatList.",
            },
          ],
        },
      ],
      // WARN: raw RN primitives not yet migrated. Text is the last remaining
      // Kit-only-rollout holdout; flip it to ERROR (move to the rule above)
      // once its apps/app file count hits 0. Runs as a separate
      // typescript-eslint rule so ERROR + WARN severities coexist.
      "@typescript-eslint/no-restricted-imports": [
        "warn",
        {
          paths: [
            {
              name: "react-native",
              importNames: ["Text"],
              message:
                "Prefer Text from '@metro-labs/kit/text' instead of react-native (Kit-only rollout).",
            },
          ],
        },
      ],
    },
  },
  {
    // Messaging boundary: component code must import the XMTP messaging surface
    // through the `modules/messaging` facade, never by reaching into the
    // `lib/xmtp.*` internals directly. The facade barrel itself and the lib
    // internals are exempt (they aren't under components/). This re-declares the
    // full no-restricted-imports rule (View + the messaging pattern) because a
    // later flat-config block fully overrides an earlier one for matched files.
    files: ["components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "react-native",
              importNames: ["View"],
              message:
                "Use Box/Row/Col from '@/components/layout' instead of View for layout containers.",
            },
            {
              name: "react-native",
              importNames: ["Image"],
              message:
                "Import Image from '@metro-labs/kit/image' instead of react-native.",
            },
            {
              name: "react-native",
              importNames: ["TextInput"],
              message:
                "Use Input/Textarea from '@metro-labs/kit/input' | '@metro-labs/kit/textarea' instead of react-native TextInput.",
            },
          ],
          patterns: [
            {
              // lib/xmtp.* covers the client lifecycle + the xmtp.state caches
              // (feedCache / activeFeedLines / inboxEthCache).
              group: ["**/lib/xmtp", "**/lib/xmtp.*"],
              message:
                "Import messaging via the '@/modules/messaging' facade barrel, not the lib/xmtp.* internals.",
            },
            {
              // The account-switch epoch signal: use useActiveAccount() /
              // AccountManager from the facade, not lib/accountEpoch directly.
              group: ["**/lib/accountEpoch"],
              message:
                "Use useActiveAccount() / AccountManager from '@/modules/messaging', not lib/accountEpoch.",
            },
            {
              // The channels-list cache: import the cache surface from the facade.
              group: ["**/lib/channelsCache"],
              message:
                "Import the channels cache via the '@/modules/messaging' facade barrel, not lib/channelsCache.",
            },
          ],
        },
      ],
    },
  },
  {
    // The Box/Row/Col primitives wrap View — they must be allowed to import it.
    files: ["components/layout/**"],
    rules: {
      "no-restricted-imports": "off",
      "@typescript-eslint/no-restricted-imports": "off",
    },
  },
  {
    // Build-config files (metro.config.js, expo config plugins) are CommonJS —
    // require() is the correct module syntax there, and they aren't app source.
    files: ["**/*.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
);
