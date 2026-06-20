import tseslint from "typescript-eslint";
import { MAX_LINES, recommended, NO_ESCAPE_HATCHES, commentPlugins, COMMENT_RULES, FUNCTION_SIZE_RULES } from "./base.js";

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
            if (!expr || expr.type !== "Identifier") return;
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
      create(context) {
        const file = (context.filename ?? context.getFilename?.() ?? "").replace(/\\/g, "/");
        if (file.endsWith("/lib/zerodev/keyring.ts")) return {};
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

export const customRules = { ...metroThemeNative.rules, ...keyringGuardRule };

export function reactNative() {
  return [
    { ignores: ["node_modules/**", ".expo/**", "dist/**", "nodejs-assets/**"] },
    ...recommended,
    {
      files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}", "modules/**/*.{ts,tsx}"],
      plugins: { metro: { rules: { ...metroThemeNative.rules, ...keyringGuardRule } }, ...commentPlugins },
      rules: {
        ...COMMENT_RULES,
        ...FUNCTION_SIZE_RULES,
        "metro/prefer-role-variant": "warn",
        "metro/no-keyring-bypass": "error",
        ...NO_ESCAPE_HATCHES,
        "no-restricted-syntax": [
          "error",
          {
            selector:
              "Property[key.name='fontSize'] > Literal[value=type(number)]",
            message:
              "use a named Kit size token (Text size=\"sm|md|lg|...\" prop, or fontSize('md')/FONT_SIZE.md from '@stage-labs/kit/tokens') instead of a raw fontSize number.",
          },
          {
            selector:
              "JSXElement[openingElement.name.name=/^(Text|Title|Caption)$/] JSXAttribute[name.name=/^(style|textStyle)$/] Property[key.name='fontSize']",
            message:
              "Kit Text/Title/Caption must size via the `size` prop (size=\"sm|md|lg|...\"), not a fontSize in style. Remove fontSize from the style and pass size= instead.",
          },
          {
            selector:
              "JSXElement[openingElement.name.name=/^(Text|Title|Caption)$/] JSXAttribute[name.name=/^(style|textStyle)$/] Property[key.name='fontFamily']",
            message:
              "Kit Text/Title/Caption apply Calibre internally - do not set fontFamily in style. Use the `weight` prop (normal/medium/semibold/bold) for the face, or variant=\"mono\" for monospace.",
          },
          {
            selector:
              "JSXElement[openingElement.name.name=/^(Text|Title|Caption)$/] JSXAttribute[name.name=/^(style|textStyle)$/] Property[key.name='color']",
            message:
              "Kit Text/Title/Caption must take their colour via the `color` prop (color={pal.text}), not a color in style. Remove color from the style and pass color= instead.",
          },
          {
            selector:
              "JSXOpeningElement[name.name='Box'] > JSXAttribute[name.name='style'] > JSXExpressionContainer ObjectExpression > Property[key.name=/^(flex|flexDirection)$/]",
            message:
              "Box must not set flex/flexDirection in style. Use Row (flexDirection:'row') or Col (column, the default), and pass flex-grow via the `flex` prop (<Col flex={1}>) instead of a style flex.",
          },
          {
            selector:
              "JSXOpeningElement[name.name=/^(Box|Row|Col)$/] > JSXAttribute[name.name='style'] > JSXExpressionContainer ObjectExpression > Property[key.name=/^(alignItems|justifyContent|gap|padding|paddingHorizontal|paddingVertical|paddingTop|paddingRight|paddingBottom|paddingLeft|margin|marginHorizontal|marginVertical|marginTop|marginRight|marginBottom|marginLeft)$/]",
            message:
              "Box/Row/Col: use the layout prop instead of a style entry - alignItems->align, justifyContent->justify, gap->gap, padding*->padding (scalar or {x,y,top,right,bottom,left}), margin*->margin (same Spacing shape) (see kit/src/layout.ts).",
          },
          {
            selector:
              "JSXOpeningElement[name.name=/^(Box|Row|Col)$/] > JSXAttribute[name.name='style'] > JSXExpressionContainer ObjectExpression > Property[key.name='backgroundColor']",
            message:
              "Box/Row/Col: use the `surface` variant (surface/raised/sunken/toolbar) or the `background` override prop, not a backgroundColor in style.",
          },
        ],
        "max-lines": MAX_LINES,
        "@typescript-eslint/no-require-imports": "off",
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
                  "Import Image from '@stage-labs/kit/image' instead of react-native.",
              },
              {
                name: "react-native",
                importNames: ["TextInput"],
                message:
                  "Use Input/Textarea from '@stage-labs/kit/input' | '@stage-labs/kit/textarea' instead of react-native TextInput.",
              },
              {
                name: "react-native",
                importNames: ["ScrollView"],
                message:
                  "Use Scroll from '@stage-labs/kit/scroll' instead of react-native ScrollView.",
              },
              {
                name: "react-native",
                importNames: ["Pressable"],
                message:
                  "Use Pressable from '@stage-labs/kit/pressable' (or Kit Button) instead of react-native Pressable.",
              },
              {
                name: "react-native",
                importNames: ["FlatList"],
                message:
                  "Use FlatList from '@stage-labs/kit/flat-list' instead of react-native FlatList.",
              },
            ],
          },
        ],
        "@typescript-eslint/no-restricted-imports": [
          "warn",
          {
            paths: [
              {
                name: "react-native",
                importNames: ["Text"],
                message:
                  "Prefer Text from '@stage-labs/kit/text' instead of react-native (Kit-only rollout).",
              },
            ],
          },
        ],
      },
    },
    {
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
                  "Import Image from '@stage-labs/kit/image' instead of react-native.",
              },
              {
                name: "react-native",
                importNames: ["TextInput"],
                message:
                  "Use Input/Textarea from '@stage-labs/kit/input' | '@stage-labs/kit/textarea' instead of react-native TextInput.",
              },
            ],
            patterns: [
              {
                group: ["**/lib/xmtp", "**/lib/xmtp.*"],
                message:
                  "Import messaging via the '@/modules/messaging' facade barrel, not the lib/xmtp.* internals.",
              },
              {
                group: ["**/lib/accountEpoch"],
                message:
                  "Use useActiveAccount() / AccountManager from '@/modules/messaging', not lib/accountEpoch.",
              },
              {
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
      files: ["components/layout/**"],
      rules: {
        "no-restricted-imports": "off",
        "@typescript-eslint/no-restricted-imports": "off",
      },
    },
    {
      files: ["**/*.js"],
      rules: {
        "@typescript-eslint/no-require-imports": "off",
      },
    },
  ];
}

export function kitEslint() {
  return [
    { ignores: ["node_modules/**", "dist/**", "src/heroicons.data.ts"] },
    ...recommended,
    {
      files: ["src/**/*.{ts,tsx}"],
      plugins: commentPlugins,
      rules: {
        ...NO_ESCAPE_HATCHES,
        ...COMMENT_RULES,
        ...FUNCTION_SIZE_RULES,
        "max-lines": MAX_LINES,
        "no-restricted-syntax": [
          "error",
          {
            selector:
              "JSXOpeningElement[name.name='Box'] > JSXAttribute[name.name='style'] > JSXExpressionContainer > ObjectExpression > Property[key.name=/^(flex|flexDirection)$/]",
            message:
              "Box must not set flex/flexDirection in style. Use Row (flexDirection:'row') or Col (column, the default), and pass flex-grow via the `flex` prop (<Col flex={1}>) instead of a style flex.",
          },
          {
            selector:
              "JSXOpeningElement[name.name=/^(Box|Row|Col)$/] > JSXAttribute[name.name='style'] > JSXExpressionContainer > ObjectExpression > Property[key.name=/^(alignItems|justifyContent|gap|flex|padding|paddingHorizontal|paddingVertical|paddingTop|paddingRight|paddingBottom|paddingLeft|margin|marginHorizontal|marginVertical|marginTop|marginRight|marginBottom|marginLeft|backgroundColor|borderRadius|width|height|minWidth|minHeight|maxWidth|maxHeight|aspectRatio)$/]",
            message:
              "Box/Row/Col: use the ChatKit layout param instead of a style entry - alignItems->align, justifyContent->justify, gap->gap, flex->flex, padding*->padding, margin*->margin (Spacing), backgroundColor->background, borderRadius->radius (token), width/height/min*/max*/aspectRatio->the same-named sizing param (see ./layout.ts). Props with no ChatKit param (borderWidth/borderColor/position/overflow/opacity/shadow/zIndex/transform) stay in style.",
          },
        ],
      },
    },
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
