import type { Story } from '../gallery/story';
import { Spinner, type SpinnerProps } from '../src/react-native/spinner';
import { color, range } from './_controls';

export default { title: 'Spinner' };

export const Controls: Story<SpinnerProps> = (args) => <Spinner {...args} />;
Controls.args = { size: 28 };
Controls.argTypes = { size: range(12, 96, 4), color };
