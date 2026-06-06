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
      // `error`: every file in the client has been split to 200 lines or fewer.
      // Hard cap, no exceptions - split a file rather than crossing it.
      "max-lines": ["error", { max: 200, skipBlankLines: false, skipComments: false }],
    },
  },
);
