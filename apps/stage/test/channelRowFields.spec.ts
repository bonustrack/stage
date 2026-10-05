import { describe, expect, test } from 'bun:test';
import { visibleChannelFields } from '../components/ChannelRowFields.model';
import { CHANNEL_FIELDS, DEFAULT_CHANNEL_FIELDS, type ChannelFields } from '../components/home/fields.model';

const all: ChannelFields = { members: true, assignees: true, category: true, status: true, labels: true, priority: true, avatar: true };
const data = {
  peerAddress: null,
  inboxToAddr: { self: '0xabc', friend: '0xDEF', duplicate: '0xAbC', empty: '' },
  assigned: ['0xDEF', '0xdef'], category: 'Stage', status: 'In progress', priority: 'High',
};

describe('channel row metadata', () => {
  test('default rows and cards keep their existing layout with no new footer', () => {
    expect(visibleChannelFields(data, DEFAULT_CHANNEL_FIELDS.chats)).toEqual([]);
    expect(visibleChannelFields(data, DEFAULT_CHANNEL_FIELDS.board)).toEqual([]);
  });

  test('shows each selected field once, including self among members', () => {
    const fields = visibleChannelFields(data, all);
    expect(fields.map(field => field.id)).toEqual(['members', 'assignees', 'category', 'status', 'priority']);
    expect(fields[0]?.addresses).toEqual(['0xabc', '0xdef']);
    expect(fields[1]?.addresses).toEqual(['0xdef']);
    expect(fields.slice(2).map(field => field.value)).toEqual(['Stage', 'In progress', 'High']);
  });

  test('people fields keep avatars and accessible labels without leading icons, while the menu keeps its icons', () => {
    const fields = visibleChannelFields(data, all);
    expect(fields.slice(0, 2)).toEqual([
      { id: 'members', label: 'Members', value: '', addresses: ['0xabc', '0xdef'] },
      { id: 'assignees', label: 'Assignees', value: '', addresses: ['0xdef'] },
    ]);
    expect(fields.slice(2).map(field => field.icon)).toEqual(['IconFolder1', 'IconCircleDashed', 'IconFlag1']);
    expect(CHANNEL_FIELDS.filter(field => field.id === 'members' || field.id === 'assignees').map(field => field.icon))
      .toEqual(['IconPeople', 'IconPeopleCircle']);
  });

  test('each visibility toggle affects only its field', () => {
    for (const id of ['members', 'assignees', 'category', 'status', 'priority'] as const) {
      expect(visibleChannelFields(data, { ...all, [id]: false })).toEqual(visibleChannelFields(data, all).filter(field => field.id !== id));
    }
    expect(visibleChannelFields(data, { ...all, labels: false })).toEqual(visibleChannelFields(data, all));
    expect(visibleChannelFields(data, { ...all, avatar: false })).toEqual(visibleChannelFields(data, all));
  });

  test('missing and blank metadata produces no empty fields or spacer', () => {
    expect(visibleChannelFields({}, all)).toEqual([]);
    expect(visibleChannelFields({ inboxToAddr: {}, assigned: [], category: null, status: '  ', priority: '' }, all)).toEqual([]);
    expect(visibleChannelFields({ ...data, category: ' Stage ', status: null, priority: undefined }, all).map(field => field.value))
      .toEqual(['', '', 'Stage']);
  });

  test('assignees only include current members, independently of the Members choice', () => {
    const fields = visibleChannelFields({ ...data, assigned: ['0xDEF', '0x999'] }, { ...all, members: false });
    expect(fields[0]?.addresses).toEqual(['0xdef']);
    expect(visibleChannelFields({ assigned: ['0xdef'] }, all)).toEqual([]);
  });

  test('direct chats never gain channel metadata', () => {
    expect(visibleChannelFields({ ...data, peerAddress: '0xdef' }, all)).toEqual([]);
  });
});
