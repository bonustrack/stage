import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["node_modules/**", ".expo/**", "dist/**"] },
  ...tseslint.configs.recommended,
  {
    files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}"],
    rules: {
      // `warn`, not `error`: RN screens/components legitimately exceed 200 lines.
      // Keeps the signal (tracks files to split later) without failing CI.
      "max-lines": ["warn", { max: 200, skipBlankLines: false, skipComments: false }],
      /** React Native bundles assets via require() — exempt. */
      "@typescript-eslint/no-require-imports": "off",
      // Steer layout containers to the Box/Row/Col primitives instead of raw View.
      // Only `View` is restricted — ScrollView, Pressable, Animated.View, etc. are fine.
      // `error`: all holdouts have been migrated to Box/Row/Col. Where a raw View
      // is genuinely required (onLayout/ref measurement, overlays, MaskedView
      // children, etc.), add a targeted
      // `// eslint-disable-next-line no-restricted-imports` at the import site.
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
    },
  },
);
