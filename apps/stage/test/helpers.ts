import { expect } from 'bun:test';

export function snap(tree: unknown): void {
  expect(tree).toBeDefined();
  expect(tree).toMatchSnapshot();
  expect(JSON.parse(JSON.stringify(tree))).toEqual(tree);
}
