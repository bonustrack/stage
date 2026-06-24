import { inject, provide, type InjectionKey } from 'vue';
import type {
  WidgetActionRegistry,
  WidgetDataContext,
  Scheme,
} from '../chatkit';

export interface ChatKitFormContext {
  setValue: (name: string, value: unknown) => void;
  getValues: () => Record<string, unknown>;
}

export interface ChatKitRenderContext {
  registry: WidgetActionRegistry;
  data: WidgetDataContext;
  scheme: Scheme;
}

export const ChatKitFormKey: InjectionKey<ChatKitFormContext | null> =
  Symbol('ChatKitForm');

export const ChatKitRenderKey: InjectionKey<ChatKitRenderContext> =
  Symbol('ChatKitRender');

export function provideChatKitForm(ctx: ChatKitFormContext): void {
  provide(ChatKitFormKey, ctx);
}

export function useChatKitForm(): ChatKitFormContext | null {
  return inject(ChatKitFormKey, null);
}

export function provideChatKitRender(ctx: ChatKitRenderContext): void {
  provide(ChatKitRenderKey, ctx);
}

export function useChatKitRender(): ChatKitRenderContext {
  const ctx = inject(ChatKitRenderKey, null);
  if (ctx) return ctx;
  return { registry: {}, data: {}, scheme: 'light' };
}
