import { builtinRules } from 'eslint/use-at-your-own-risk';

export default {
  meta: { name: 'core' },
  rules: {
    'no-restricted-syntax': builtinRules.get('no-restricted-syntax'),
    quotes: builtinRules.get('quotes'),
  },
};
