import type { FC } from 'react';

export type ControlType = 'select' | 'boolean' | 'text' | 'number' | 'range' | 'color';

export interface ArgType<T = unknown> {
  control: { type: ControlType; min?: number; max?: number; step?: number };
  options?: readonly T[];
}

export type ArgTypes<P> = { [K in keyof P]?: ArgType<P[K]> };

export interface Story<P = Record<string, never>> extends FC<P> {
  args?: Partial<P>;
  argTypes?: ArgTypes<P>;
}

export type AnyStory = Story<Record<string, unknown>>;

export interface StoryEntry {
  id: string;
  componentId: string;
  component: string;
  name: string;
  render: AnyStory;
}

export interface StoryModule {
  default?: { title?: string };
  [exportName: string]: unknown;
}

export function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function nameOf(exportName: string): string {
  return exportName.replace(/([a-z])([A-Z])/g, '$1 $2');
}

export function collectStories(modules: Record<string, StoryModule>): StoryEntry[] {
  const entries: StoryEntry[] = [];
  for (const [path, mod] of Object.entries(modules)) {
    const component = mod.default?.title ?? path.replace(/^.*\//, '').replace(/\.stories\.tsx$/, '');
    const componentId = slug(component);
    for (const [exportName, value] of Object.entries(mod)) {
      if (exportName === 'default' || typeof value !== 'function') continue;
      entries.push({ id: `${componentId}--${slug(exportName)}`, componentId, component, name: nameOf(exportName), render: value as AnyStory });
    }
  }
  return entries.sort((a, b) => a.component.localeCompare(b.component) || a.name.localeCompare(b.name));
}
