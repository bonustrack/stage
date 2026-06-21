# `@stage-labs/kit/vue/*` — Vue renderers

Vue.js renderers for the Stage design system. The package layout treats the two
renderer families as symmetric siblings over a shared, framework-agnostic core:

```
packages/kit/src/
  <shared framework-agnostic modules>   tokens.ts, layout.ts, icons.ts, theme.ts,
                                        theme-derive.ts, avatar.ts, radius.ts,
                                        button.styles.ts, control.styles.ts,
                                        heroicons.data.ts, brand-icons.data.ts
  react-native/   RN .tsx renderers + RN React-context theme-context.tsx
  vue/            Vue .vue renderers + Vue theme-context.ts (this directory)
```

Both families reuse the framework-agnostic token, layout, icon, and style
modules (`src/tokens.ts`, `src/layout.ts`, `src/icons.ts`,
`src/button.styles.ts`, `src/control.styles.ts`) — never reimplement that logic,
import it. Vue SFCs reach the shared modules via `../<name>`; RN renderers under
`react-native/` do the same. Public subpaths mirror each other:
`@stage-labs/kit/react-native/<name>` and `@stage-labs/kit/vue/<name>`.

Consumed as subpath imports:

```ts
import Button from '@stage-labs/kit/vue/button';
import { provideKitTheme, useKitPalette } from '@stage-labs/kit/vue/theme-context';
```

## Authoring rules

1. **One `.vue` SFC per component**, `<script setup lang="ts">` + TypeScript.
   File name is PascalCase (`Button.vue`); the subpath export is kebab-case
   (`./vue/button`).
2. **Prop-API parity with the RN renderer.** Same prop names and semantics
   (`role` / `variant` / `size` / `color` / `radius` / `dark` / …). When the RN
   component takes a render-prop or `ReactNode`, expose it as a named slot
   (`iconStart` / `iconEnd`). Callbacks become emits (`onPress` → `@press`,
   `onChangeText` → `v-model` / `@update:modelValue`).
3. **Styling = inline `:style` objects**, matching the existing `apps/ui`
   idiom (`src/components/layout/boxStyle.ts`). Build a `Record<string, string>`
   and convert kit's numeric style entries to `px` strings. Do not author
   Tailwind classes inside kit — theme reactivity comes from the palette
   composable, and raw layout/colour comes from the shared modules.
4. **Theme** is read with `useKitPalette()` / `useKitScheme()` from
   `./theme-context`. A host provides it once via `provideKitTheme({ scheme })`.
   The shape (`KitPalette`) is identical to the RN
   `react-native/theme-context.tsx`.
5. **Icons** use `currentColor` by default (see `Icon.vue`), so colour flows
   from CSS `color`, matching `apps/ui/src/components/HeroIcon.vue`.
6. **No comments** in `.vue`/`.ts` script blocks — the repo's
   `comments/no-comments` ESLint rule applies. Express intent through names and
   types. (Markdown like this file is exempt.)

## Adding a new component (checklist)

- Create `src/vue/<Name>.vue` mirroring the RN prop API.
- Add a subpath export to `packages/kit/package.json`:
  `"./vue/<name>": "./src/vue/<Name>.vue"`.
- Re-export from `src/vue/index.ts`.
- `bun run lint && bun run typecheck && bun run knip && bun run build` stay green.
