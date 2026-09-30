import { describe, expect, test } from 'bun:test';
import { describeAppDataChange } from '../src/xmtp/appDataChange';
import { groupUpdateInboxIds, humanizeGroupUpdated } from '../src/xmtp/humanize';

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

describe('assignment changes in appData', () => {
  const alice = `0x${'a'.repeat(40)}`;
  const bob = `0x${'b'.repeat(40)}`;
  const carol = `0x${'c'.repeat(40)}`;
  const assigned = (value: unknown): string => JSON.stringify({ v: 1, assigned: value });

  test('names an added assignee using the existing address mention format', () => {
    expect(describeAppDataChange(assigned([]), assigned([alice]))).toBe(`assigned @${alice}`);
  });

  test('names only the removed assignee', () => {
    expect(describeAppDataChange(assigned([alice, bob]), assigned([alice]))).toBe(`unassigned @${bob}`);
  });

  test('names every assignee when clearing the assignment', () => {
    expect(describeAppDataChange(assigned([alice, bob]), assigned([]))).toBe(`unassigned @${alice}, @${bob}`);
  });

  test('describes multiple additions and removals together', () => {
    expect(describeAppDataChange(assigned([alice, bob]), assigned([carol]))).toBe(`assigned @${carol} • unassigned @${alice}, @${bob}`);
    expect(describeAppDataChange(assigned([alice]), assigned([bob, carol]))).toBe(`assigned @${bob}, @${carol} • unassigned @${alice}`);
  });

  test('reads older objects and a known empty appData value as unassigned', () => {
    expect(describeAppDataChange(blob([]), assigned([alice]))).toBe(`assigned @${alice}`);
    expect(describeAppDataChange('', assigned([alice]))).toBe(`assigned @${alice}`);
    expect(describeAppDataChange(assigned([alice]), blob([]))).toBe(`unassigned @${alice}`);
  });

  test('ignores case, duplicate and order-only changes', () => {
    const upper = `0x${'A'.repeat(40)}`;
    expect(describeAppDataChange(assigned([upper, bob, bob]), assigned([bob, alice]))).toBe('updated the channel settings');
  });

  test('normalizes valid addresses and ignores invalid array entries', () => {
    expect(describeAppDataChange(assigned([null, 17, 'bad', ` ${alice} `]), assigned(['bad', bob, bob])))
      .toBe(`assigned @${bob} • unassigned @${alice}`);
  });

  test('does not invent deltas from missing or malformed event values', () => {
    for (const unknown of [undefined, 'not json', '[1]', 'null', 'false']) {
      expect(describeAppDataChange(unknown, assigned([alice]))).toBe('updated the channel settings');
      expect(describeAppDataChange(assigned([alice]), unknown)).toBe('updated the channel settings');
    }
    for (const malformed of [null, 17, 'bad', {}]) {
      expect(describeAppDataChange(assigned(malformed), assigned([alice]))).toBe('updated the channel settings');
      expect(describeAppDataChange(assigned([alice]), assigned(malformed))).toBe('updated the channel settings');
    }
  });

  test('retains label and GitHub details in a combined update', () => {
    const before = JSON.stringify({ v: 1, labels: ['Todo'], assigned: [alice], preview: 'old' });
    const after = JSON.stringify({ v: 1, labels: ['Stage'], assigned: [bob], github: 'https://github.com/o/r', preview: 'new' });
    expect(describeAppDataChange(before, after))
      .toBe(`added label "Stage" • removed label "Todo" • linked github.com/o/r • assigned @${bob} • unassigned @${alice}`);
    expect(describeAppDataChange(assigned([alice]), JSON.stringify({ assigned: [alice], preview: 'new', future: true })))
      .toBe('updated the channel settings');
  });

  test('works through both native and browser metadata field aliases', () => {
    const changes = [{ fieldName: 'app_data', oldValue: assigned([]), newValue: assigned([alice]) }];
    expect(humanizeGroupUpdated({ metadataFieldsChanged: changes })).toBe(`assigned @${alice}`);
    expect(humanizeGroupUpdated({ metadataFieldChanges: changes })).toBe(`assigned @${alice}`);
  });

  test('retains other field and membership updates alongside assignments', () => {
    const update = {
      metadataFieldsChanged: [
        { fieldName: 'app_data', oldValue: assigned([alice]), newValue: assigned([bob]) },
        { fieldName: 'group_name', newValue: 'New name' },
        { fieldName: 'description', newValue: 'New description' },
        { fieldName: 'group_image_url_square', newValue: 'new.png' },
      ],
      membersAdded: [{ inboxId: 'new-member' }],
    };
    expect(humanizeGroupUpdated(update, () => 'Carol'))
      .toBe(`assigned @${bob} • unassigned @${alice} • renamed the channel to "New name" • updated the channel description • updated the channel image • added Carol`);
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

  test('names the known members and counts the unknown ones', () => {
    expect(humanizeGroupUpdated({ addedInboxes: [{ inboxId: 'a' }, { inboxId: 'z' }] }, nameOf)).toBe('added Alice and 1 other');
    const mixed = ['a', 'y', 'b', 'z'].map(inboxId => ({ inboxId }));
    expect(humanizeGroupUpdated({ membersRemoved: mixed }, nameOf)).toBe('removed Alice, @bobby1 and 2 others');
    expect(humanizeGroupUpdated({ removedInboxes: [{ inboxId: 'z' }, { inboxId: 'y' }] }, nameOf)).toBe('removed 2 members');
    expect(humanizeGroupUpdated({ addedInboxes: [{ inboxId: 'a' }] })).toBe('added 1 member');
  });

  test('lists every member an update names, from web and mobile shapes', () => {
    const web = { addedInboxes: [{ inboxId: 'a' }], removedInboxes: [{ inboxId: 'b' }], leftInboxes: [{ inboxId: 'c' }] };
    expect(groupUpdateInboxIds(web)).toEqual(['a', 'b', 'c']);
    expect(groupUpdateInboxIds({ membersAdded: [{ inboxId: 'a' }], membersRemoved: [{ inboxId: 'd' }] })).toEqual(['a', 'd']);
    expect(groupUpdateInboxIds({ metadataFieldsChanged: [] })).toEqual([]);
  });
});
