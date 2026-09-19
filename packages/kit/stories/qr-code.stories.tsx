import type { Story } from '../gallery/story';
import { QrCode, type QrCodeProps } from '../src/react-native/qr-code';
import { color, range, text } from './_controls';

export default { title: 'QR Code' };

export const Controls: Story<QrCodeProps> = (args) => <QrCode {...args} />;
Controls.args = { value: 'https://stage.box', size: 160, color: '#000000', background: '#ffffff' };
Controls.argTypes = { value: text, size: range(64, 512, 16), color, background: color };
