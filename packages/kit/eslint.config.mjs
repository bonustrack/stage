import tseslint from "typescript-eslint";

export default tseslint.config(
  // Generated files are not linted. heroicons.data.ts is the tool-generated
  // Heroicons v1 outline catalogue (data, not hand-written logic).
  { ignores: ["node_modules/**", "dist/**", "src/heroicons.data.ts"] },
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      // Strong typing: ban `any`. Use `unknown` + narrowing, real interfaces,
      // generics, or library types instead.
      "@typescript-eslint/no-explicit-any": "error",
      // `error`: every hand-written file in the kit is split to <=200 lines.
      // Hard cap, no exceptions for real source: split rather than cross it.
      "max-lines": ["error", { max: 200, skipBlankLines: false, skipComments: false }],
    },
  },
);
