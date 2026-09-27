import { useEffect } from 'react';
import { galleryKeyStep, isEditableTarget } from './imageGallery.model';

export function useGalleryKeys(active: boolean, onStep: (delta: number) => void): void {
  useEffect(() => {
    if (!active) return undefined;
    const onKeyDown = (event: KeyboardEvent): void => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      const delta = galleryKeyStep(event, isEditableTarget(target?.tagName ?? null, target?.isContentEditable === true));
      if (delta === 0) return;
      event.preventDefault();
      onStep(delta);
    };
    window.addEventListener('keydown', onKeyDown);
    return (): void => { window.removeEventListener('keydown', onKeyDown); };
  }, [active, onStep]);
}
