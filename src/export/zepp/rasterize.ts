import type { ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { toPng } from 'html-to-image';

export function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Renders a React node offscreen and rasterizes it to PNG bytes at exactly
 * width × height. Used to bake watchface layers into device-resolution assets.
 */
export async function renderNodeToPng(
  node: ReactNode,
  width: number,
  height: number,
): Promise<Uint8Array> {
  const host = document.createElement('div');
  host.style.position = 'fixed';
  host.style.left = '-100000px';
  host.style.top = '0';
  document.body.appendChild(host);
  const target = document.createElement('div');
  target.style.width = `${width}px`;
  target.style.height = `${height}px`;
  host.appendChild(target);
  const root = createRoot(target);
  try {
    root.render(node);
    await document.fonts.ready;
    // let React commit + images decode
    await wait(120);
    const dataUrl = await toPng(target, { width, height, pixelRatio: 1 });
    return dataUrlToBytes(dataUrl);
  } finally {
    root.unmount();
    host.remove();
  }
}
