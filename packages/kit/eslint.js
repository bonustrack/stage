import { MAX_LINES, recommended, NO_ESCAPE_HATCHES, commentPlugins, COMMENT_RULES, FUNCTION_SIZE_RULES } from '@stage-labs/config/eslint/base';

const BOX_STYLE = {
  selector:
    "JSXOpeningElement[name.name='Box'] > JSXAttribute[name.name='style'] > JSXExpressionContainer > ObjectExpression > Property[key.name=/^(flex|flexDirection)$/]",
  message:
    "Box must not set flex/flexDirection in style. Use Row (flexDirection:'row') or Col (column, the default), and pass flex-grow via the `flex` prop (<Col flex={1}>) instead of a style flex.",
};

const BOX_LAYOUT = {
  selector:
    "JSXOpeningElement[name.name=/^(Box|Row|Col)$/] > JSXAttribute[name.name='style'] > JSXExpressionContainer > ObjectExpression > Property[key.name=/^(alignItems|justifyContent|gap|flex|padding|paddingHorizontal|paddingVertical|paddingTop|paddingRight|paddingBottom|paddingLeft|margin|marginHorizontal|marginVertical|marginTop|marginRight|marginBottom|marginLeft|backgroundColor|borderRadius|width|height|minWidth|minHeight|maxWidth|maxHeight|aspectRatio)$/]",
  message:
    'Box/Row/Col: use the Kit layout param instead of a style entry - alignItems->align, justifyContent->justify, gap->gap, flex->flex, padding*->padding, margin*->margin (Spacing), backgroundColor->background, borderRadius->radius (token), width/height/min*/max*/aspectRatio->the same-named sizing param (see ./layout.ts). Props with no Kit param (borderWidth/borderColor/position/overflow/opacity/shadow/zIndex/transform) stay in style.',
};

const RAW_FONT_SIZE = {
  selector: "Property[key.name='fontSize'] > Literal[value=type(number)]",
  message:
    "Use a named Kit size token (FONT_SIZE.md / fontSize('md') from './tokens') instead of a raw fontSize number.",
};

const RAW_HEX = {
  selector: 'Literal[value=/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/]',
  message:
    "Use a token from './tokens' (schemePalette()/colors/resolveColorToken) instead of a raw hex colour.",
};

const BASE_SYNTAX = [BOX_STYLE, BOX_LAYOUT];

export function kitEslint() {
  return [
    { ignores: ['node_modules/**', 'dist/**', 'build/**', 'src/heroicons.data.ts', 'src/heroicons.solid.data.ts'] },
    ...recommended,
    {
      files: ['src/**/*.{ts,tsx}'],
      plugins: commentPlugins,
      rules: {
        ...NO_ESCAPE_HATCHES,
        ...COMMENT_RULES,
        ...FUNCTION_SIZE_RULES,
        'max-lines': MAX_LINES,
        'no-restricted-syntax': ['error', ...BASE_SYNTAX],
      },
    },
    {
      files: ['src/button.styles.ts', 'src/control.styles.ts', 'src/react-native/select.tsx'],
      rules: {
        'no-restricted-syntax': ['error', ...BASE_SYNTAX, RAW_FONT_SIZE],
      },
    },
    {
      files: ['src/react-native/card.tsx', 'src/react-native/list-view.tsx'],
      rules: {
        'no-restricted-syntax': ['error', ...BASE_SYNTAX, RAW_FONT_SIZE, RAW_HEX],
      },
    },
  ];
}
