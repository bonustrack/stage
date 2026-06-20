/** @file @stage-labs/config React Native ESLint flat-config preset: relocates the RN/Kit lint rules verbatim, exposing reactNative() (apps/app), kitEslint() (packages/kit), and the shared custom rules. */
import tseslint from "typescript-eslint";
import { MAX_LINES, recommended, NO_ESCAPE_HATCHES, commentPlugins, COMMENT_RULES, FUNCTION_SIZE_RULES } from "./base.js";

/** Custom inline rule: theme-native role/surface hint (WARNING). */
const TEXT_ROLE_HINT = {
  link: 'role="link" (or drop it - default text is already the head colour)',
  danger: 'role="danger"',
  success: 'role="success"',
  sub: 'role="secondary"',
};
const BOX_SURFACE_HINT = {
  bg: 'surface="surface"',
  inputBg: 'surface="raised"',
  rowBg: 'surface="raised"',
  toolbarBg: 'surface="toolbar"',
};
const TEXT_TAGS = new Set(["Text", "Title", "Caption"]);
const BOX_TAGS = new Set(["Box", "Row", "Col"]);
const metroThemeNative = {
  rules: {
    "prefer-role-variant": {
      meta: { type: "suggestion", docs: { description: "prefer theme-native role/surface variants over per-call color/background palette idents" }, schema: [] },
      /** Report color=/background= palette idents that have a role/surface variant. */
      create(context) {
        return {
          JSXAttribute(node) {
            const attr = node.name && node.name.name;
            if (attr !== "color" && attr !== "background") return;
            const open = node.parent;
            const tag = open && open.name && open.name.name;
            if (!tag) return;
            const val = node.value;
            if (!val || val.type !== "JSXExpressionContainer") return;
            const expr = val.expression;
            if (!expr || expr.type !== "Identifier") return; /** bare ident only */
            const name = expr.name;
            if (attr === "color" && TEXT_TAGS.has(tag) && TEXT_ROLE_HINT[name]) {
              context.report({ node, message: `theme-native: prefer ${TEXT_ROLE_HINT[name]} over color={${name}} on <${tag}> (color is an override escape hatch).` });
            } else if (attr === "background" && BOX_TAGS.has(tag) && BOX_SURFACE_HINT[name]) {
              context.report({ node, message: `theme-native: prefer ${BOX_SURFACE_HINT[name]} over background={${name}} on <${tag}> (background is an override escape hatch).` });
            }
          },
        };
      },
    },
  },
};

/** Custom inline rule: KEYRING GUARD (ERROR) - single private-key chokepoint. */
const SECRET_KEY_CONSTANTS = new Set(["PK_PREFIX", "LEGACY_PK_KEY"]);
const SECRET_VIEM_NAMES = new Set([
  "privateKeyToAccount", "generatePrivateKey", "mnemonicToAccount", "hdKeyToAccount",
]);
const keyringGuardRule = {
  "no-keyring-bypass": {
      meta: {
        type: "problem",
        docs: { description: "only lib/zerodev/keyring may import private-key/mnemonic primitives" },
        schema: [],
      },
      /** Fail any private-key/mnemonic import outside lib/zerodev/keyring. */
      create(context) {
        const file = (context.filename ?? context.getFilename?.() ?? "").replace(/\\/g, "/");
        /** The keyring itself is the ONE allowed importer. */
        if (file.endsWith("/lib/zerodev/keyring.ts")) return {};
        /** Report a forbidden import node with a keyring-guard message. */
        const fail = (node, what) =>
          context.report({
            node,
            message:
              `Keyring guard: ${what} must only be imported by lib/zerodev/keyring (the single ` +
              `private-key/mnemonic chokepoint). Use the keyring's public API instead.`,
          });
        return {
          ImportDeclaration(node) {
            const src = node.source.value;
            if (src === "@stage-labs/client/zerodev/derive") {
              /** deriveOwner / generateWalletMnemonic actually derive from the secret. */
              for (const s of node.specifiers) {
                const name = s.imported?.name;
                if (name === "deriveOwner" || name === "generateWalletMnemonic" || name === "ownerAddress") {
                  fail(node, `'${name}' from @stage-labs/client/zerodev/derive`);
                }
              }
            } else if (src === "@stage-labs/client/accounts/keys") {
              for (const s of node.specifiers) {
                if (s.imported && SECRET_KEY_CONSTANTS.has(s.imported.name)) {
                  fail(node, `the private-key storage-key constant '${s.imported.name}'`);
                }
              }
            } else if (src === "viem/accounts") {
              for (const s of node.specifiers) {
                if (s.imported && SECRET_VIEM_NAMES.has(s.imported.name)) {
                  fail(node, `'${s.imported.name}' from viem/accounts`);
                }
              }
            }
          },
        };
      },
    },
};

/** The custom rule definitions, exported for reuse by future RN packages. */
export const customRules = { ...metroThemeNative.rules, ...keyringGuardRule };

/** Build the full apps/app flat-config array (theme-native, keyring guard, import/structural bans, max-lines, .js CJS exemption). */
export function reactNative() {
  return [
    /** nodejs-assets/ is the embedded-Node host (own runtime, excluded from the Metro bundle), so app TS/RN lint rules don't apply. */
    { ignores: ["node_modules/**", ".expo/**", "dist/**", "nodejs-assets/**"] },
    ...recommended,
    {
      files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}", "modules/**/*.{ts,tsx}"],
      plugins: { metro: { rules: { ...metroThemeNative.rules, ...keyringGuardRule } }, ...commentPlugins },
      rules: {
        /** Comment conventions: 1 JSDoc per function, 1 line each, `@file` header (capped at 3 lines), block comments only. */
        ...COMMENT_RULES,
        /** Function size: cap each function at 100 lines (skipping blanks/comments) and cyclomatic complexity at 15. */
        ...FUNCTION_SIZE_RULES,
        /** THEME-NATIVE: WARNING nudging per-call color=/background= palette idents toward the semantic role/surface variant. */
        "metro/prefer-role-variant": "warn",
        /** KEYRING GUARD (ERROR): only lib/zerodev/keyring may import private-key/mnemonic primitives + storage-key constants. */
        "metro/no-keyring-bypass": "error",
        /** Strong typing: ban `any` + the type-system escape hatches (ts-comment, non-null `!`); use unknown + narrowing instead. */
        ...NO_ESCAPE_HATCHES,
        /** Typography: ERRORs keep text sizing on the named Kit scale via the `size` prop and the font family inside the Kit content components. */
        "no-restricted-syntax": [
          "error",
          {
            selector:
              "Property[key.name='fontSize'] > Literal[value=type(number)]",
            message:
              "use a named Kit size token (Text size=\"sm|md|lg|...\" prop, or fontSize('md')/FONT_SIZE.md from '@metro-labs/kit/tokens') instead of a raw fontSize number.",
          },
          {
            /** Kit CONTENT components (Text/Title/Caption) must size via the `size` prop, never a fontSize in style/textStyle; non-content surfaces are not matched. */
            selector:
              "JSXElement[openingElement.name.name=/^(Text|Title|Caption)$/] JSXAttribute[name.name=/^(style|textStyle)$/] Property[key.name='fontSize']",
            message:
              "Kit Text/Title/Caption must size via the `size` prop (size=\"sm|md|lg|...\"), not a fontSize in style. Remove fontSize from the style and pass size= instead.",
          },
          {
            /** Kit CONTENT components apply Calibre internally via the `weight` prop, so callers must NOT set fontFamily in style; non-content surfaces are not matched. */
            selector:
              "JSXElement[openingElement.name.name=/^(Text|Title|Caption)$/] JSXAttribute[name.name=/^(style|textStyle)$/] Property[key.name='fontFamily']",
            message:
              "Kit Text/Title/Caption apply Calibre internally - do not set fontFamily in style. Use the `weight` prop (normal/medium/semibold/bold) for the face, or variant=\"mono\" for monospace.",
          },
          {
            /** Kit CONTENT components take their colour via the `color` prop, never a `color` in style/textStyle; non-content surfaces are not matched. */
            selector:
              "JSXElement[openingElement.name.name=/^(Text|Title|Caption)$/] JSXAttribute[name.name=/^(style|textStyle)$/] Property[key.name='color']",
            message:
              "Kit Text/Title/Caption must take their colour via the `color` prop (color={pal.text}), not a color in style. Remove color from the style and pass color= instead.",
          },
          {
            /** Layout: a `<Box>` is direction-neutral and must NOT set flex/flexDirection in style; use Row/Col and the `flex` prop. Only Box is matched. */
            selector:
              "JSXOpeningElement[name.name='Box'] > JSXAttribute[name.name='style'] > JSXExpressionContainer ObjectExpression > Property[key.name=/^(flex|flexDirection)$/]",
            message:
              "Box must not set flex/flexDirection in style. Use Row (flexDirection:'row') or Col (column, the default), and pass flex-grow via the `flex` prop (<Col flex={1}>) instead of a style flex.",
          },
          {
            /** Layout params: Box/Row/Col expose props for align/justify/gap/padding/margin; the raw RN style equivalents must not be set on the direct-child style literal (see kit/src/layout.ts). */
            selector:
              "JSXOpeningElement[name.name=/^(Box|Row|Col)$/] > JSXAttribute[name.name='style'] > JSXExpressionContainer ObjectExpression > Property[key.name=/^(alignItems|justifyContent|gap|padding|paddingHorizontal|paddingVertical|paddingTop|paddingRight|paddingBottom|paddingLeft|margin|marginHorizontal|marginVertical|marginTop|marginRight|marginBottom|marginLeft)$/]",
            message:
              "Box/Row/Col: use the layout prop instead of a style entry - alignItems->align, justifyContent->justify, gap->gap, padding*->padding (scalar or {x,y,top,right,bottom,left}), margin*->margin (same Spacing shape) (see kit/src/layout.ts).",
          },
          {
            /** THEME-NATIVE: Box/Row/Col take their fill via the `surface` variant or `background` prop, never a backgroundColor in style. */
            selector:
              "JSXOpeningElement[name.name=/^(Box|Row|Col)$/] > JSXAttribute[name.name='style'] > JSXExpressionContainer ObjectExpression > Property[key.name='backgroundColor']",
            message:
              "Box/Row/Col: use the `surface` variant (surface/raised/sunken/toolbar) or the `background` override prop, not a backgroundColor in style.",
          },
        ],
        /** `error`: cap files at 400 lines; split a file rather than crossing it. */
        "max-lines": MAX_LINES,
        /** React Native bundles assets via require() — exempt. */
        "@typescript-eslint/no-require-imports": "off",
        /** ERROR: ban raw RN primitives with a migrated Kit equivalent (View -> Box/Row/Col, Image -> @metro-labs/kit/image); disable per-line where a raw View is genuinely required. */
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
        /** WARN: raw RN primitives not yet migrated (Text holdout); a separate ts-eslint rule so ERROR + WARN severities coexist. */
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
      /** Messaging boundary: components must import XMTP via the `modules/messaging` facade, not lib/xmtp.* internals; re-declares the full no-restricted-imports rule since a later block overrides an earlier one. */
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
                /** lib/xmtp.* covers the client lifecycle + the xmtp.state caches (feedCache / activeFeedLines / inboxEthCache). */
                group: ["**/lib/xmtp", "**/lib/xmtp.*"],
                message:
                  "Import messaging via the '@/modules/messaging' facade barrel, not the lib/xmtp.* internals.",
              },
              {
                /** The account-switch epoch signal: use useActiveAccount() / AccountManager from the facade, not lib/accountEpoch directly. */
                group: ["**/lib/accountEpoch"],
                message:
                  "Use useActiveAccount() / AccountManager from '@/modules/messaging', not lib/accountEpoch.",
              },
              {
                /** The channels-list cache: import the cache surface from the facade. */
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
      /** The Box/Row/Col primitives wrap View — they must be allowed to import it. */
      files: ["components/layout/**"],
      rules: {
        "no-restricted-imports": "off",
        "@typescript-eslint/no-restricted-imports": "off",
      },
    },
    {
      /** Build-config files (metro.config.js, expo config plugins) are CommonJS — require() is correct and they aren't app source. */
      files: ["**/*.js"],
      rules: {
        "@typescript-eslint/no-require-imports": "off",
      },
    },
  ];
}

/** Build the full packages/kit flat-config array (Kit layout structural bans + token-discipline blocks). */
export function kitEslint() {
  return [
    /** Generated files are not linted: heroicons.data.ts is the tool-generated Heroicons v1 outline catalogue (data, not logic). */
    { ignores: ["node_modules/**", "dist/**", "src/heroicons.data.ts"] },
    ...recommended,
    {
      files: ["src/**/*.{ts,tsx}"],
      plugins: commentPlugins,
      rules: {
        /** Strong typing: ban `any` + the type-system escape hatches (ts-comment, non-null `!`); use unknown + narrowing instead. */
        ...NO_ESCAPE_HATCHES,
        /** Comment conventions: 1 JSDoc per function, 1 line each, `@file` header (capped at 3 lines), block comments only. */
        ...COMMENT_RULES,
        /** Function size: cap each function at 100 lines (skipping blanks/comments) and cyclomatic complexity at 15. */
        ...FUNCTION_SIZE_RULES,
        /** `error`: cap hand-written files at 400 lines; split rather than cross it. */
        "max-lines": MAX_LINES,
        /** Layout: a `<Box>` is direction-neutral and must NOT set flex/flexDirection in style; use Row/Col and the `flex` prop. Only Box is matched. */
        "no-restricted-syntax": [
          "error",
          {
            selector:
              "JSXOpeningElement[name.name='Box'] > JSXAttribute[name.name='style'] > JSXExpressionContainer > ObjectExpression > Property[key.name=/^(flex|flexDirection)$/]",
            message:
              "Box must not set flex/flexDirection in style. Use Row (flexDirection:'row') or Col (column, the default), and pass flex-grow via the `flex` prop (<Col flex={1}>) instead of a style flex.",
          },
          {
            /** Layout params: Box/Row/Col expose props for align/justify/gap/padding/margin/etc; the raw RN style equivalents must not be set on the direct-child style literal (see ./layout.ts). */
            selector:
              "JSXOpeningElement[name.name=/^(Box|Row|Col)$/] > JSXAttribute[name.name='style'] > JSXExpressionContainer > ObjectExpression > Property[key.name=/^(alignItems|justifyContent|gap|flex|padding|paddingHorizontal|paddingVertical|paddingTop|paddingRight|paddingBottom|paddingLeft|margin|marginHorizontal|marginVertical|marginTop|marginRight|marginBottom|marginLeft|backgroundColor|borderRadius|width|height|minWidth|minHeight|maxWidth|maxHeight|aspectRatio)$/]",
            message:
              "Box/Row/Col: use the ChatKit layout param instead of a style entry - alignItems->align, justifyContent->justify, gap->gap, flex->flex, padding*->padding, margin*->margin (Spacing), backgroundColor->background, borderRadius->radius (token), width/height/min*/max*/aspectRatio->the same-named sizing param (see ./layout.ts). Props with no ChatKit param (borderWidth/borderColor/position/overflow/opacity/shadow/zIndex/transform) stay in style.",
          },
        ],
      },
    },
    /** Token discipline (PR #408): Kit internals must size + colour through tokens.ts; (1) no raw numeric fontSize on the migrated component set - use FONT_SIZE.<step> / fontSize('md'). */
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
    /** (2) No raw hex/rgb colour literals on the fully-migrated surfaces (they route colour through schemePalette()/colors); files with no token equivalent keep the fontSize ban only. */
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
  ];
}
