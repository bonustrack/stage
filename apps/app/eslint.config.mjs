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
    },
  },
);
