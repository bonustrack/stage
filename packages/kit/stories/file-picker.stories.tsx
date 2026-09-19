import { useState } from 'react';
import type { Story } from '../gallery/story';
import { FilePicker, type FilePickerProps, type PickedFile } from '../src/react-native/file-picker';
import { Button } from '../src/react-native/button';
import { Col } from '../src/react-native/box';
import { Text } from '../src/react-native/text';
import { bool, number, range, select, useDark } from './_controls';

export default { title: 'File Picker' };

export const Controls: Story<Omit<FilePickerProps, 'openNonce' | 'onPick' | 'onCancel'> & { videos: boolean }> = ({ videos, ...args }) => {
  const [nonce, setNonce] = useState(0);
  const [picked, setPicked] = useState<PickedFile[]>([]);
  return (
    <Col gap={12}>
      <Button dark={useDark()} label="Pick files" onPress={() => { setNonce((n) => n + 1); }} />
      <FilePicker {...args} mediaTypes={videos ? ['images', 'videos'] : ['images']} openNonce={nonce} onPick={setPicked} onCancel={() => { setPicked([]); }} />
      {picked.map((f) => <Text key={f.uri} size="sm" role="secondary">{f.name ?? f.uri.slice(0, 40)} · {f.mime}</Text>)}
    </Col>
  );
};
Controls.args = { source: 'library', videos: false, multiple: true, selectionLimit: 4, quality: 0.8, allowsEditing: false };
Controls.argTypes = { source: select(['library', 'camera', 'document']), videos: bool, multiple: bool, selectionLimit: number, quality: range(0, 1, 0.1), allowsEditing: bool };
