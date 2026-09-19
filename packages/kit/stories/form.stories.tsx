import { useState } from 'react';
import type { Story } from '../gallery/story';
import { Form, useFormSubmit, type FormProps } from '../src/react-native/form';
import { Input } from '../src/react-native/input';
import { Label } from '../src/react-native/label';
import { Button } from '../src/react-native/button';
import { Text } from '../src/react-native/text';
import { number, select, useDark } from './_controls';

export default { title: 'Form' };

function SubmitButton(): React.ReactElement {
  const submit = useFormSubmit();
  return <Button dark={useDark()} label="Submit" onPress={submit} />;
}

export const Controls: Story<FormProps> = (args) => {
  const dark = useDark();
  const [submitted, setSubmitted] = useState(0);
  return (
    <Form {...args} onSubmit={() => { setSubmitted((n) => n + 1); }}>
      <Label dark={dark} value="Name" />
      <Input dark={dark} placeholder="Ada Lovelace" />
      <Label dark={dark} value="Email" />
      <Input dark={dark} placeholder="ada@example.com" inputType="email" />
      <SubmitButton />
      <Text role="secondary" size="sm">Submitted {submitted} times</Text>
    </Form>
  );
};
Controls.args = { direction: 'col', gap: 12 };
Controls.argTypes = { direction: select(['row', 'col']), gap: number, padding: number };
