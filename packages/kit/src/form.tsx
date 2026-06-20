
import { createContext, useContext, type ReactNode } from 'react';
import { Box, type BoxProps } from './box';

interface FormContextValue {
  submit: () => void;
}

const FormContext = createContext<FormContextValue>({
  submit: () => undefined,
});

export function useFormSubmit(): () => void {
  return useContext(FormContext).submit;
}

export interface FormProps extends Omit<BoxProps, 'direction'> {
  direction?: 'row' | 'col';
  onSubmit?: () => void;
  children?: ReactNode;
}

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
