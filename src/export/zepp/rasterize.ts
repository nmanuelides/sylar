import type { ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { toPng, getFontEmbedCSS } from 'html-to-image';
import { loadedFontFamilies } from '@/data/fonts';

export function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// html-to-image's own used-font detector only walks HTMLElement children
// (see its embed-webfonts.js), so it never enters an SVG subtree — every
// element we bake (SVGTextElement etc.) is invisible to it, and it silently
// skips embedding any font, leaving baked text to fall back to a default
// font. Work around it by probing with a plain HTMLElement whose own
// font-family lists every family loaded this session — the detector reads
// the root node's own style directly, no traversal needed — then reuse the
// resulting (already base64-embedded) CSS for every bake in this session.
let embedCacheKey = '';
let embedCache: Promise<string> | null = null;
function getEmbeddedFontCSS(): Promise<string> {
  const key = loadedFontFamilies().join('|');
  if (!key) return Promise.resolve('');
  if (!embedCache || key !== embedCacheKey) {
    embedCacheKey = key;
    const probe = document.createElement('div');
    probe.style.position = 'fixed';
    probe.style.opacity = '0';
    probe.style.pointerEvents = 'none';
    probe.style.fontFamily = loadedFontFamilies()
      .map((f) => `"${f}"`)
      .join(', ');
    document.body.appendChild(probe);
    embedCache = getFontEmbedCSS(probe).finally(() => probe.remove());
  }
  return embedCache;
}

/**
 * Renders a single character directly onto a <canvas> and returns PNG bytes.
 * Used instead of renderNodeToPng for single-glyph digit sprites: baking text
 * via an SVG-as-image (html-to-image's approach — serialize to a data: URI,
 * draw it as an <img>) never picks up embedded custom webfonts here, for any
 * font, even with the embedding fixes above — the <img>'s internal font
 * parsing races its own decode() and consistently loses. Canvas 2D text
 * reads straight from the main document's `document.fonts` (already awaited
 * ready by the caller), with no serialize/decode round-trip to race against.
 */
export async function renderGlyphToPng(
  ch: string,
  width: number,
  height: number,
  fontFamily: string,
  fontWeight: number,
  fontSize: number,
  color: string,
): Promise<Uint8Array> {
  // document.fonts.ready only covers loads already in flight — a family
  // that's never been asked to render digits/hyphen before (true for most
  // projects) may not have fetched that specific glyph subset yet. Force it.
  await document.fonts.load(`${fontWeight} 10px "${fontFamily}"`, '0123456789-').catch(() => {});
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.font = `${fontWeight} ${fontSize}px "${fontFamily}"`;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(ch, width / 2, height / 2);
  return dataUrlToBytes(canvas.toDataURL('image/png'));
}

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
    const fontEmbedCSS = await getEmbeddedFontCSS();
    const dataUrl = await toPng(target, { width, height, pixelRatio: 1, fontEmbedCSS });
    return dataUrlToBytes(dataUrl);
  } finally {
    root.unmount();
    host.remove();
  }
}
