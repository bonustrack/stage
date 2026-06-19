/** Form - a ChatKit-styled form container. Mirrors ChatKit's `Form` widget.
 *  Faithful prop names: `direction` ('row' | 'col') plus the full Box layout API
 *  (BoxBaseProps: gap / padding / align / justify / etc), since ChatKit's Form
 *  extends BoxBaseProps. Deviation (kit is interactive RN, not server-streamed):
 *  ChatKit's `onSubmitAction` (a server ActionConfig fired when a child submit
 *  button is pressed) is replaced by an `onSubmit()` callback exposed to children
 *  via React context, so a kit Button/Input inside the form can trigger it. The
 *  form itself is a Box; it groups controls and owns the submit handler. */

import { createContext, useContext, type ReactNode } from 'react';
import { Box, type BoxProps } from './box';

interface FormContextValue {
  /** Fire the form's onSubmit handler (no-op outside a Form). */
  submit: () => void;
}

const FormContext = createContext<FormContextValue>({
  submit: () => {
    /* intentional no-op: default submit outside a Form provider */
  },
});

/** Access the enclosing Form's submit handler (for kit submit controls). */
export function useFormSubmit(): () => void {
  return useContext(FormContext).submit;
}

export interface FormProps extends Omit<BoxProps, 'direction'> {
  /** ChatKit: direction. Layout axis for the grouped controls. Default 'col'. */
  direction?: 'row' | 'col';
  /** RN substitute for ChatKit's onSubmitAction. */
  onSubmit?: () => void;
  children?: ReactNode;
}

/** ChatKit-style RN form container. The container itself is colour-agnostic;
 *  pass `dark` to the kit controls placed inside it. */
export function Form(props: FormProps): React.ReactElement {
  const { direction = 'col', onSubmit, children, gap = 12, ...rest } = props;
  const submit = (): void => {
    onSubmit?.();
  };
  return (
    <FormContext.Provider value={{ submit }}>
      <Box direction={direction} gap={gap} {...rest}>
        {children}
      </Box>
    </FormContext.Provider>
  );
}
