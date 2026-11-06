import { isEventAction } from '../a2ui/protocol';
import type { RenderContext } from './a2ui-context';
import { useModalClose } from './modal';

export function useA2uiAction(ctx: RenderContext): (action?: unknown) => void {
  const closeModal = useModalClose();
  return (action = ctx.instance.action) => {
    const result = ctx.dispatch(action);
    if (result?.ok === true && isEventAction(action)) closeModal?.();
  };
}
