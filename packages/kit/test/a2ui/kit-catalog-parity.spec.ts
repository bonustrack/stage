import { describe, expect, mock, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as ReactNativeWeb from 'react-native-web';
import { createA2uiClient, type ClientDiagnostic } from '../../src/a2ui/client';
import { KIT_CATALOG } from '../../src/a2ui/kit-catalog';
import { isJsonObject, type JsonObject, type JsonValue } from '../../src/a2ui/protocol';
import { BASIC_CATALOG } from '../../src/a2ui/schemas';
import type { IconName } from '../../src/react-native/icon';
import {
  CHOICE_PICKER_DISPLAY_STYLES,
  CHOICE_PICKER_VARIANTS,
  DIVIDER_AXES,
  FLEX_ALIGNS,
  FLEX_JUSTIFY,
  IMAGE_FITS,
  IMAGE_VARIANTS,
  LIST_DIRECTIONS,
  TEXT_FIELD_VARIANTS,
  TEXT_VARIANTS,
} from '../../src/kit-vocabulary';
import * as SAMPLES from '../../stories/a2ui-samples';

const stub = (): null => null;
mock.module('react-native', () => ReactNativeWeb);
mock.module('react-native-svg', () => import('react-native-svg/lib/module/elements.web.js'));
mock.module('../../src/react-native/dialog', () => ({ Dialog: stub }));
mock.module('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }) }));
mock.module('../../src/react-native/sortable', () => ({
  SortableHandle: stub,
  SortableItem: stub,
  SortableList: stub,
  SortableScope: stub,
}));
mock.module('../../src/react-native/video', () => ({ Video: stub }));
mock.module('../../src/react-native/audio-player', () => ({ AudioPlayer: stub }));

const { KIT_RENDERERS } = await import('../../src/react-native/a2ui-renderers');
const { MEDIA_RENDERERS } = await import('../../src/react-native/a2ui-media');
const { Icon } = await import('../../src/react-native/icon');

function objectAt(value: JsonValue | undefined): JsonObject {
  return isJsonObject(value) ? value : {};
}

function basicEnum(component: string, prop: string): JsonValue[] {
  const found: JsonValue[][] = [];
  const walk = (value: JsonValue | undefined): void => {
    if (Array.isArray(value)) value.forEach(walk);
    if (!isJsonObject(value)) return;
    const property = objectAt(objectAt(value.properties)[prop]);
    if (Array.isArray(property.enum)) found.push(property.enum);
    Object.values(value).forEach(walk);
  };
  walk(objectAt(objectAt(BASIC_CATALOG.components)[component]));
  return found[0] ?? [];
}

function kitIconNames(): string[] {
  const name = objectAt(objectAt(objectAt(objectAt(KIT_CATALOG.components).Icon).properties).name);
  const options = Array.isArray(name.oneOf) ? name.oneOf : [];
  return options.flatMap((option) => {
    const names = objectAt(option).enum;
    return Array.isArray(names) ? names.filter((value) => typeof value === 'string') : [];
  });
}

describe('Kit catalog parity', () => {
  test('every catalog component has a renderer, and every renderer a catalog component', () => {
    const catalog = Object.keys(objectAt(KIT_CATALOG.components)).sort();
    const renderers = Object.keys({ ...KIT_RENDERERS, ...MEDIA_RENDERERS }).sort();
    expect(renderers).toEqual(catalog);
  });

  test('the basic catalog props the renderers read take values the basic catalog allows', () => {
    const cases: [string, string, readonly string[]][] = [
      ['Text', 'variant', TEXT_VARIANTS],
      ['Image', 'fit', IMAGE_FITS],
      ['Image', 'variant', IMAGE_VARIANTS],
      ['Divider', 'axis', DIVIDER_AXES],
      ['TextField', 'variant', TEXT_FIELD_VARIANTS],
      ['ChoicePicker', 'variant', CHOICE_PICKER_VARIANTS],
      ['ChoicePicker', 'displayStyle', CHOICE_PICKER_DISPLAY_STYLES],
      ['List', 'direction', LIST_DIRECTIONS],
      ['List', 'align', FLEX_ALIGNS],
      ['Row', 'justify', FLEX_JUSTIFY],
      ['Row', 'align', FLEX_ALIGNS],
      ['Column', 'align', FLEX_ALIGNS],
    ];
    for (const [component, prop, values] of cases) expect([...basicEnum(component, prop)].sort()).toEqual([...values].sort());
  });

  test('every icon name the Kit catalog takes renders an icon', () => {
    const names = kitIconNames();
    expect(names).toContain('pin');
    const blank = names.filter((name) => !renderToStaticMarkup(createElement(Icon, { name: name as IconName })).includes('<svg'));
    expect(blank).toEqual([]);
  });

  for (const [name, messages] of Object.entries(SAMPLES)) {
    test(`the gallery sample ${name} validates with no diagnostics`, () => {
      const diagnostics: ClientDiagnostic[] = [];
      const client = createA2uiClient({ onDiagnostic: (diagnostic) => diagnostics.push(diagnostic) });
      for (const message of messages) client.receive(message);
      expect(diagnostics).toEqual([]);
      expect(client.surfaceIds().length).toBeGreaterThan(0);
    });
  }
});
