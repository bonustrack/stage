import { describe, expect, test } from 'bun:test';
import { splitCodeBlocks } from '../components/bubble/codeBlock.model';

const POLICY = [
  '{"Version":"2012-10-17","Statement":[',
  '{"Effect":"Allow","Action":["ec2:DescribeRegions"],"Resource":"*"},',
  '{"Effect":"Allow","Action":"sts:AssumeRole","Resource":"arn:aws:iam::*:role/metro-cloudwatch-read"}]}',
].join('\n');

describe('splitCodeBlocks', () => {
  test('keeps a body without a fence as one untouched text part', () => {
    expect(splitCodeBlocks('**hi**\n\nuse `npm i` here\n')).toEqual([{ type: 'text', text: '**hi**\n\nuse `npm i` here\n' }]);
    expect(splitCodeBlocks('say ```x``` inline')).toEqual([{ type: 'text', text: 'say ```x``` inline' }]);
    expect(splitCodeBlocks('```x``` inline\n')).toEqual([{ type: 'text', text: '```x``` inline\n' }]);
  });

  test('splits text, a fenced block with its language and the text after it', () => {
    expect(splitCodeBlocks(`Replace it with:\n\n\`\`\`json\n${POLICY}\n\`\`\`\n\nThen Save.`)).toEqual([
      { type: 'text', text: 'Replace it with:' },
      { type: 'code', code: POLICY, lang: 'json' },
      { type: 'text', text: 'Then Save.' },
    ]);
  });

  test('copies the exact code, markdown characters and spacing included', () => {
    const code = '  *a* _b_ \\n [c](d)  \n\n\tend';
    expect(splitCodeBlocks(`\`\`\`\n${code}\n\`\`\``)).toEqual([{ type: 'code', code }]);
  });

  test('keeps only the first word of the info string as the language', () => {
    expect(splitCodeBlocks('```ts title="a.ts"\nconst a = 1;\n```')).toEqual([{ type: 'code', code: 'const a = 1;', lang: 'ts' }]);
  });

  test('closes only on a fence of the same kind and at least the same length', () => {
    expect(splitCodeBlocks('````md\n```js\nx\n```\n````')).toEqual([{ type: 'code', code: '```js\nx\n```', lang: 'md' }]);
    expect(splitCodeBlocks('~~~\n```\n~~~')).toEqual([{ type: 'code', code: '```' }]);
  });

  test('runs an unclosed fence to the end of the message', () => {
    expect(splitCodeBlocks('Log:\n```\nline 1\nline 2')).toEqual([
      { type: 'text', text: 'Log:' },
      { type: 'code', code: 'line 1\nline 2' },
    ]);
  });

  test('strips the fence indentation from an indented block in a list', () => {
    expect(splitCodeBlocks('1. Run:\n   ```sh\n   bun i\n     --frozen\n   ```\n2. Done')).toEqual([
      { type: 'text', text: '1. Run:' },
      { type: 'code', code: 'bun i\n  --frozen', lang: 'sh' },
      { type: 'text', text: '2. Done' },
    ]);
  });

  test('reads CRLF line ends and keeps consecutive blocks apart', () => {
    expect(splitCodeBlocks('```\r\na\r\n```\r\n```\r\nb\r\n```')).toEqual([
      { type: 'code', code: 'a' },
      { type: 'code', code: 'b' },
    ]);
  });
});
