import { createRequire } from 'node:module';
import { describe, expect, test } from 'bun:test';

interface GradleProperty { type: string; key: string; value: string }
interface GradleMemory { setGradleMemory(p: GradleProperty[]): unknown }

const requireCjs = createRequire(import.meta.url);
const { setGradleMemory } = requireCjs('../plugins/gradleMemory.js') as GradleMemory;

describe('gradle.properties memory', () => {
  test('bumps org.gradle.jvmargs heap so R8/signing does not OOM', () => {
    const props = [{ type: 'property', key: 'org.gradle.jvmargs', value: '-Xmx2048m' }];
    setGradleMemory(props);
    const jvm = props.find((p) => p.key === 'org.gradle.jvmargs');
    expect(jvm?.value).toContain('-Xmx6144m');
    expect(jvm?.value).toContain('MaxMetaspaceSize');
  });

  test('adds the prop when absent', () => {
    const props: GradleProperty[] = [];
    setGradleMemory(props);
    expect(props.find((p) => p.key === 'org.gradle.jvmargs')?.value).toContain('-Xmx6144m');
  });
});
