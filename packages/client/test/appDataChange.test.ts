import { describe, expect, test } from 'bun:test';
import { describeAppDataChange } from '../src/xmtp/appDataChange';
import { humanizeGroupUpdated } from '../src/xmtp/humanize';

const blob = (labels: string[], github?: string): string => JSON.stringify({ v: 1, labels, ...(github ? { github } : {}) });

describe('describeAppDataChange', () => {
  test('names the labels that were added and removed', () => {
    expect(describeAppDataChange(blob(['Todo']), blob(['In progress']))).toBe('added label "In progress" • removed label "Todo"');
    expect(describeAppDataChange('', blob(['Blocked', 'Urgent']))).toBe('added labels "Blocked", "Urgent"');
  });

  test('ignores label case changes and reorders', () => {
    expect(describeAppDataChange(blob(['a', 'B']), blob(['b', 'a']))).toBe('updated the channel settings');
  });

  test('describes the GitHub link', () => {
    expect(describeAppDataChange(blob([]), blob([], 'https://github.com/o/r/pull/7'))).toBe('linked github.com/o/r/pull/7');
    expect(describeAppDataChange(blob([], 'https://github.com/o/r/pull/7'), blob([]))).toBe('unlinked the GitHub link');
  });

  test('falls back for unreadable data', () => {
    expect(describeAppDataChange('not json', '[1]')).toBe('updated the channel settings');
  });

  test('replaces the vague app data line in group updates', () => {
    const text = humanizeGroupUpdated({ metadataFieldsChanged: [{ fieldName: 'app_data', oldValue: '', newValue: blob(['Blocked']) }] });
    expect(text).toBe('added label "Blocked"');
  });
});

describe('humanizeGroupUpdated member names', () => {
  const names: Record<string, string> = { a: 'Alice', b: '@bobby1', c: 'you', d: 'Dan' };
  const nameOf = (id: string): string | null => names[id] ?? null;

  test('names who was added and removed', () => {
    expect(humanizeGroupUpdated({ addedInboxes: [{ inboxId: 'c' }] }, nameOf)).toBe('added you');
    expect(humanizeGroupUpdated({ membersAdded: [{ inboxId: 'a' }, { inboxId: 'b' }] }, nameOf)).toBe('added Alice and @bobby1');
    expect(humanizeGroupUpdated({ removedInboxes: [{ inboxId: 'd' }] }, nameOf)).toBe('removed Dan');
  });

  test('shortens long lists', () => {
    const members = ['a', 'b', 'c', 'd'].map(inboxId => ({ inboxId }));
    expect(humanizeGroupUpdated({ addedInboxes: members }, nameOf)).toBe('added Alice, @bobby1 and 2 others');
  });

  test('falls back to a count when a member is unknown', () => {
    expect(humanizeGroupUpdated({ addedInboxes: [{ inboxId: 'a' }, { inboxId: 'z' }] }, nameOf)).toBe('added 2 members');
    expect(humanizeGroupUpdated({ addedInboxes: [{ inboxId: 'a' }] })).toBe('added 1 member');
  });
});
