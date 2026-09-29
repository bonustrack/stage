import { createRequire } from 'node:module';
import { describe, expect, test } from 'bun:test';
import type { MarkdownIt } from 'react-native-markdown-display';
import { literalStars, taskLists, taskStateOf } from '../components/bubble/markdown.model';

const createParser = createRequire(import.meta.url)('markdown-it') as (options: object) => MarkdownIt;
const md = createParser({ typographer: false, linkify: true, breaks: true }).use(literalStars).use(taskLists);

function inline(text: string): string {
  return md.renderInline(text);
}

describe('literalStars', () => {
  test('keeps stars that are not emphasis as typed', () => {
    expect(inline('2 * 3 * 4 = 24')).toBe('2 * 3 * 4 = 24');
    expect(inline('2*3*4 = 24')).toBe('2*3*4 = 24');
    expect(inline('arn:aws:iam::*:role/x')).toBe('arn:aws:iam::*:role/x');
    expect(inline('{"Resource":"*"},{"Resource":"arn:aws:iam::*:role/metro-box"}'))
      .toBe('{&quot;Resource&quot;:&quot;*&quot;},{&quot;Resource&quot;:&quot;arn:aws:iam::*:role/metro-box&quot;}');
    expect(inline('src/**/*.ts and lib/**/*.js')).toBe('src/**/*.ts and lib/**/*.js');
  });

  test('still renders real emphasis', () => {
    expect(inline('*italic*, **bold** and ***both***')).toBe('<em>italic</em>, <strong>bold</strong> and <em><strong>both</strong></em>');
    expect(inline('(*a*) "**b**": _c_')).toBe('(<em>a</em>) &quot;<strong>b</strong>&quot;: <em>c</em>');
    expect(inline('**Note:** read *this*.')).toBe('<strong>Note:</strong> read <em>this</em>.');
  });
});

describe('taskLists', () => {
  const items = (source: string): { task: string | undefined; text: string }[] => {
    const tokens = md.parse(source, {});
    return tokens.flatMap((token, index) => {
      if (token.type !== 'list_item_open') return [];
      const content = tokens[index + 2]?.content ?? '';
      return [{ task: taskStateOf(Object.fromEntries(token.attrs ?? [])), text: content }];
    });
  };

  test('marks todo and done items and drops the brackets', () => {
    expect(items('- [ ] Task not done\n- [x] Task done\n- [X] Also done')).toEqual([
      { task: 'todo', text: 'Task not done' },
      { task: 'done', text: 'Task done' },
      { task: 'done', text: 'Also done' },
    ]);
  });

  test('leaves plain items and look-alikes alone', () => {
    expect(items('- Bullet\n- [link](https://stage.box)\n- [ ]\n- [y] no')).toEqual([
      { task: undefined, text: 'Bullet' },
      { task: undefined, text: '[link](https://stage.box)' },
      { task: undefined, text: '[ ]' },
      { task: undefined, text: '[y] no' },
    ]);
  });

  test('reads nested and ordered task items', () => {
    expect(items('1. [x] Ship\n   - [ ] Nested')).toEqual([
      { task: 'done', text: 'Ship' },
      { task: 'todo', text: 'Nested' },
    ]);
  });
});
