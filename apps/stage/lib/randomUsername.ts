import { usernameFromWords } from './randomUsername.model';

export async function randomUsername(): Promise<string> {
  const { faker } = await import('@faker-js/faker/locale/en');
  return usernameFromWords({
    adjective: faker.word.adjective({ length: { min: 3, max: 8 } }),
    noun: faker.word.noun({ length: { min: 3, max: 8 } }),
    digits: String(faker.number.int({ min: 10, max: 99 })),
  });
}
