import { describe, expect, test } from 'bun:test';
import { peopleLookup } from '../components/home/contacts.model';

describe('peopleLookup', () => {
  test('a bare username is looked up as a stage name and shown as a handle', () => {
    expect(peopleLookup('tony123')).toEqual({ handle: 'tony123.stage.base.eth', title: '@tony123' });
    expect(peopleLookup('  Tony123  ')).toEqual({ handle: 'tony123.stage.base.eth', title: '@tony123' });
    expect(peopleLookup('my-stage-name')).toEqual({ handle: 'my-stage-name.stage.base.eth', title: '@my-stage-name' });
  });

  test('the app displays usernames as @label, so that form is searchable too', () => {
    expect(peopleLookup('@tony123')).toEqual({ handle: 'tony123.stage.base.eth', title: '@tony123' });
  });

  test('a label that cannot be a stage username is not looked up', () => {
    expect(peopleLookup('tony')).toBeNull();
    expect(peopleLookup('')).toBeNull();
    expect(peopleLookup('tony-')).toBeNull();
    expect(peopleLookup('x'.repeat(33))).toBeNull();
  });

  test('full names keep their own resolution and title', () => {
    expect(peopleLookup('vitalik.eth')).toEqual({ handle: 'vitalik.eth', title: 'vitalik.eth' });
    expect(peopleLookup('less.base.eth')).toEqual({ handle: 'less.base.eth', title: 'less.base.eth' });
    expect(peopleLookup('alice321.stage.base.eth')).toEqual({ handle: 'alice321.stage.base.eth', title: 'alice321.stage.base.eth' });
  });

  test('an address needs no lookup and carries no title', () => {
    const addr = '0xa94Cb9AA3CB82880142ff98706320E1Fb9B31767';
    expect(peopleLookup(addr)).toEqual({ handle: addr.toLowerCase(), title: '' });
  });
});
