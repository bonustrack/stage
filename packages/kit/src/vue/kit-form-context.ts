import { inject, provide, type InjectionKey } from 'vue';
import type {
  WidgetActionRegistry,
  WidgetDataContext,
  Scheme,
} from '../kit';

export interface KitFormContext {
  setValue: (name: string, value: unknown) => void;
  getValues: () => Record<string, unknown>;
}

export interface KitRenderContext {
  registry: WidgetActionRegistry;
  data: WidgetDataContext;
  scheme: Scheme;
}

export const KitFormKey: InjectionKey<KitFormContext | null> =
  Symbol('KitForm');

export const KitRenderKey: InjectionKey<KitRenderContext> =
  Symbol('KitRender');

export function provideKitForm(ctx: KitFormContext): void {
  provide(KitFormKey, ctx);
}

export function useKitForm(): KitFormContext | null {
  return inject(KitFormKey, null);
}

export function provideKitRender(ctx: KitRenderContext): void {
  provide(KitRenderKey, ctx);
}

export function useKitRender(): KitRenderContext {
  const ctx = inject(KitRenderKey, null);
  if (ctx) return ctx;
  return { registry: {}, data: {}, scheme: 'light' };
}
