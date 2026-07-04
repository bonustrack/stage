
import { FilePicker, type PickedFile } from '@stage-labs/kit/react-native/file-picker';

export function GroupImagePicker({ openNonce, onPick }: {
  openNonce: number;
  onPick: (file: PickedFile) => void;
}): React.ReactElement {
  return (
    <FilePicker
      openNonce={openNonce}
      source="library"
      mediaTypes={['images']}
      quality={0.85}
      multiple={false}
      allowsEditing
      aspect={[1, 1]}
      onPick={(files) => {
        const file = files[0];
        if (file !== undefined) onPick(file);
      }}
    />
  );
}
