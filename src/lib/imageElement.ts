import type { AssetItem, ImageElement } from '@/types/watchface';
import { uid } from './uid';

/**
 * Builds an image element from an asset at (x, y), sized to its natural
 * aspect ratio but capped at maxSide. Async because the image must load
 * to know its dimensions.
 */
export function buildImageElement(
  asset: AssetItem,
  x: number,
  y: number,
  maxSide: number,
  onReady: (el: ImageElement) => void,
): void {
  const img = new Image();
  const finish = (width: number, height: number) =>
    onReady({
      id: uid(),
      type: 'image',
      name: asset.name,
      x,
      y,
      width,
      height,
      rotation: 0,
      opacity: 1,
      visible: true,
      locked: false,
      assetId: asset.id,
      src: asset.src,
      fit: 'contain',
    });
  img.onload = () => {
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    finish(Math.round(img.width * scale) || 100, Math.round(img.height * scale) || 100);
  };
  img.onerror = () => finish(100, 100);
  img.src = asset.src;
}
