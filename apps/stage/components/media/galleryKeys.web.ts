import { galleryKeyStep } from './imageGallery.model';
import { useKeyStep } from '../keys/keys';
import { isEditableTarget } from '../keys/keys.model';

export function useGalleryKeys(active: boolean, onStep: (delta: number) => void): void {
  useKeyStep(
    active,
    (event, target) => galleryKeyStep(event, target !== null && isEditableTarget(target.tagName, target.contentEditable)),
    onStep,
  );
}
