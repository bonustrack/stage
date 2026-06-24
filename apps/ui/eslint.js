const BANNED_HTML = [
  { element: 'button', message: 'Use <Button> from @stage-labs/kit/vue/button instead of a raw <button>.' },
  { element: 'h1', message: 'Use <Title :level="1"> from @stage-labs/kit/vue/title instead of <h1>.' },
  { element: 'h2', message: 'Use <Title :level="2"> from @stage-labs/kit/vue/title instead of <h2>.' },
  { element: 'h3', message: 'Use <Title :level="3"> from @stage-labs/kit/vue/title instead of <h3>.' },
  { element: 'h4', message: 'Use <Title> from @stage-labs/kit/vue/title instead of <h4>.' },
  { element: 'h5', message: 'Use <Title> from @stage-labs/kit/vue/title instead of <h5>.' },
  { element: 'h6', message: 'Use <Title> from @stage-labs/kit/vue/title instead of <h6>.' },
  { element: 'input', message: 'Use <Input>/<Checkbox> from @stage-labs/kit/vue/input | @stage-labs/kit/vue/checkbox instead of a raw <input>.' },
  { element: 'textarea', message: 'Use <Textarea> from @stage-labs/kit/vue/textarea instead of a raw <textarea>.' },
  { element: 'select', message: 'Use <Select> from @stage-labs/kit/vue/select instead of a raw <select>.' },
  { element: 'div', message: 'Use <Row>/<Col>/<Scroll> from @stage-labs/kit/vue/{row,col,scroll} instead of a raw <div> (flex-row -> Row, flex-col/block -> Col, overflow/scroll -> Scroll). Genuine native cases use <component :is="\'div\'"> with a kit-exception comment.' },
];

const RESTRICTED_IMPORTS = {
  paths: [
    { name: '@/components/layout', message: 'Box/Row/Col now live in @stage-labs/kit/vue/{box,row,col} (globally registered). Drop the local import.' },
    { name: '@/components/HeroIcon.vue', message: 'Use <Icon> from @stage-labs/kit/vue/icon instead of the removed local HeroIcon.' },
  ],
  patterns: [
    { group: ['**/components/layout', '**/components/layout/*', '**/HeroIcon.vue'], message: 'The local layout/HeroIcon components were removed. Use @stage-labs/kit/vue/{box,row,col,icon} instead.' },
  ],
};

export function uiKitOnly(vuePlugin) {
  return [
    {
      files: ['src/**/*.vue'],
      plugins: { vue: vuePlugin },
      rules: {
        'vue/no-restricted-html-elements': ['error', ...BANNED_HTML],
        'no-restricted-imports': ['error', RESTRICTED_IMPORTS],
        '@typescript-eslint/no-restricted-imports': ['error', RESTRICTED_IMPORTS],
      },
    },
    {
      files: ['src/**/*.{ts,tsx}'],
      rules: {
        'no-restricted-imports': ['error', RESTRICTED_IMPORTS],
        '@typescript-eslint/no-restricted-imports': ['error', RESTRICTED_IMPORTS],
      },
    },
  ];
}
