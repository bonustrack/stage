import { describe, expect, test } from 'bun:test';
import { profileTextProblem } from '../components/profile/profileText.model';

describe('profileTextProblem', () => {
  test('only the length and line limits produce a problem', () => {
    expect(profileTextProblem({ displayName: '', description: '' })).toBeNull();
    expect(profileTextProblem({ displayName: 'Tony', description: 'Builder' })).toBeNull();
    expect(profileTextProblem({ displayName: 'a'.repeat(64), description: 'b'.repeat(280) })).toBeNull();
    expect(profileTextProblem({ displayName: 'a'.repeat(65), description: '' })).toBe('Name is limited to 64 characters.');
    expect(profileTextProblem({ displayName: 'two\nlines', description: '' })).toBe('Name cannot span several lines.');
    expect(profileTextProblem({ displayName: 'ok', description: 'b'.repeat(281) })).toBe('About is limited to 280 characters.');
  });

  test('name problems come before the about problem', () => {
    expect(profileTextProblem({ displayName: 'two\nlines', description: 'b'.repeat(281) })).toBe('Name cannot span several lines.');
  });
});
