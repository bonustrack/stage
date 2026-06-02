import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["node_modules/**", "dist/**"] },
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      // Strong typing: ban `any`. Use `unknown` + narrowing, real interfaces,
      // generics, or library types instead.
      "@typescript-eslint/no-explicit-any": "error",
      // `error`: every file in the kit has been split to ≤200 lines.
      // Hard cap, no exceptions — split a file rather than crossing it.
      "max-lines": ["error", { max: 200, skipBlankLines: false, skipComments: false }],
    },
  },
  {
    // Generated icon data: the full Heroicons v1 outline catalogue (~240
    // entries). It is data, not logic, so it is exempt from the 200-line cap.
    files: ["src/heroicons.data.ts"],
    rules: {
      "max-lines": "off",
    },
  },
);
