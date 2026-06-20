import { MAX_LINES, recommended, NO_ESCAPE_HATCHES, commentPlugins, COMMENT_RULES, FUNCTION_SIZE_RULES } from '@stage-labs/config/eslint/base';

export function kitEslint() {
  return [
    { ignores: ['node_modules/**', 'dist/**', 'src/heroicons.data.ts'] },
    ...recommended,
    {
      files: ['src/**/*.{ts,tsx}'],
      plugins: commentPlugins,
      rules: {
        ...NO_ESCAPE_HATCHES,
        ...COMMENT_RULES,
        ...FUNCTION_SIZE_RULES,
        'max-lines': MAX_LINES,
        'no-restricted-syntax': [
          'error',
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
              'Box/Row/Col: use the ChatKit layout param instead of a style entry - alignItems->align, justifyContent->justify, gap->gap, flex->flex, padding*->padding, margin*->margin (Spacing), backgroundColor->background, borderRadius->radius (token), width/height/min*/max*/aspectRatio->the same-named sizing param (see ./layout.ts). Props with no ChatKit param (borderWidth/borderColor/position/overflow/opacity/shadow/zIndex/transform) stay in style.',
          },
        ],
      },
    },
    {
      files: [
        'src/button.styles.ts',
        'src/card.tsx',
        'src/control.styles.ts',
        'src/list-view.tsx',
        'src/select.tsx',
      ],
      rules: {
        'no-restricted-syntax': [
          'error',
          {
            selector: "Property[key.name='fontSize'] > Literal[value=type(number)]",
            message:
              "Use a named Kit size token (FONT_SIZE.md / fontSize('md') from './tokens') instead of a raw fontSize number.",
          },
        ],
      },
    },
    {
      files: ['src/card.tsx', 'src/list-view.tsx'],
      rules: {
        'no-restricted-syntax': [
          'error',
          {
            selector: "Property[key.name='fontSize'] > Literal[value=type(number)]",
            message:
              "Use a named Kit size token (FONT_SIZE.md / fontSize('md') from './tokens') instead of a raw fontSize number.",
          },
          {
            selector: 'Literal[value=/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/]',
            message:
              "Use a token from './tokens' (schemePalette()/colors/resolveColorToken) instead of a raw hex colour.",
          },
        ],
      },
    },
  ];
}
