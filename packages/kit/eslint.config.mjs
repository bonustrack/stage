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
      // `error`: cap hand-written files at 400 lines. Split rather than cross it.
      "max-lines": ["error", { max: 400, skipBlankLines: false, skipComments: false }],
      // Layout: a `<Box>` is direction-neutral - it must NOT set `flex` or
      // `flexDirection` in its style. Use Row (flexDirection 'row') or Col
      // (column, the default View axis), and pass flex-grow via the `flex` PROP
      // (<Col flex={1}>), never a style flex. Only `<Box>` is matched - Row/Col
      // set flexDirection internally (via the `direction` prop) and are exempt.
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "JSXOpeningElement[name.name='Box'] > JSXAttribute[name.name='style'] > JSXExpressionContainer ObjectExpression > Property[key.name=/^(flex|flexDirection)$/]",
          message:
            "Box must not set flex/flexDirection in style. Use Row (flexDirection:'row') or Col (column, the default), and pass flex-grow via the `flex` prop (<Col flex={1}>) instead of a style flex.",
        },
        {
          // Layout params: Box/Row/Col expose first-class props for alignment,
          // distribution, gap, padding, and margin (see ./layout.ts). The raw RN
          // style equivalents must NOT be set inline in the element's own
          // top-level `style={{...}}` - pass the prop so the single mapper owns
          // the prop->style translation: alignItems->align,
          // justifyContent->justify, gap->gap, padding*->p/px/py/pt/pr/pb/pl,
          // margin*->m/mx/my/mt/mr/mb/ml. Scoped to the DIRECT-child style object
          // literal of Box/Row/Col only (same chain as the flex rule above), so
          // nested objects and child elements are never matched. Overlapping-side
          // combos that one prop can't express may keep a key in style.
          selector:
            "JSXOpeningElement[name.name=/^(Box|Row|Col)$/] > JSXAttribute[name.name='style'] > JSXExpressionContainer ObjectExpression > Property[key.name=/^(alignItems|justifyContent|gap|padding|paddingHorizontal|paddingVertical|paddingTop|paddingRight|paddingBottom|paddingLeft|margin|marginHorizontal|marginVertical|marginTop|marginRight|marginBottom|marginLeft)$/]",
          message:
            "Box/Row/Col: use the layout prop instead of a style entry - alignItems->align, justifyContent->justify, gap->gap, padding*->p/px/py/pt/pr/pb/pl, margin*->m/mx/my/mt/mr/mb/ml (see ./layout.ts).",
        },
      ],
    },
  },
  // Token discipline (extends #394's apps/app rules into the Kit package itself,
  // PR #408): the Kit component internals must size + colour through the named
  // tokens in tokens.ts, not raw literals.
  //
  // (1) No raw numeric `fontSize` on the components #408 routed through the
  //     scale - use FONT_SIZE.<step> (or fontSize('md')). Scoped to the
  //     migrated set; the rest of the package is migrated in follow-ups.
  {
    files: [
      "src/button.styles.ts",
      "src/card.tsx",
      "src/control.styles.ts",
      "src/list-view.tsx",
      "src/select.tsx",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "Property[key.name='fontSize'] > Literal[value=type(number)]",
          message:
            "Use a named Kit size token (FONT_SIZE.md / fontSize('md') from './tokens') instead of a raw fontSize number.",
        },
      ],
    },
  },
  // (2) No raw hex/rgb colour literals in style objects on the fully-migrated
  //     surfaces. These route every colour through schemePalette()/colors, so a
  //     reintroduced literal is a regression. Files that still carry a
  //     non-semantic literal with no token equivalent (button.styles.ts accent
  //     hues + DANGER, control.styles.ts/select.tsx input fill + focus accent)
  //     keep the fontSize ban only and are intentionally not listed here.
  {
    files: ["src/card.tsx", "src/list-view.tsx"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "Property[key.name='fontSize'] > Literal[value=type(number)]",
          message:
            "Use a named Kit size token (FONT_SIZE.md / fontSize('md') from './tokens') instead of a raw fontSize number.",
        },
        {
          selector: "Literal[value=/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/]",
          message:
            "Use a token from './tokens' (schemePalette()/colors/resolveColorToken) instead of a raw hex colour.",
        },
      ],
    },
  },
);
