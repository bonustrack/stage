/**
 * @file Form — a ChatKit-styled Box-based form container that groups controls and exposes an `onSubmit` callback to child Buttons/Inputs via React context.
 */

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

/** ChatKit-style RN form container. The container itself is colour-agnostic; pass `dark` to the kit controls placed inside it. */
export function Form(props: FormProps): React.ReactElement {
  const { direction = 'col', onSubmit, children, gap = 12, ...rest } = props;
  /** Submit helper. */
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
