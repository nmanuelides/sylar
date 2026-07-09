export type FontCategory = 'Tech & Display' | 'Sans' | 'Mono' | 'Serif & Script';

export interface FontOption {
  value: string;
  label: string;
  weights: number[];
  category: FontCategory;
}

const f = (value: string, weights: number[], category: FontCategory): FontOption => ({
  value,
  label: value,
  weights,
  category,
});

/** Curated Google Fonts catalog — loaded on demand via ensureFontLoaded(). */
export const FONTS: FontOption[] = [
  // Tech & Display
  f('Orbitron', [400, 500, 600, 700, 800, 900], 'Tech & Display'),
  f('Rajdhani', [300, 400, 500, 600, 700], 'Tech & Display'),
  f('Chakra Petch', [300, 400, 500, 600, 700], 'Tech & Display'),
  f('Oxanium', [400, 500, 600, 700, 800], 'Tech & Display'),
  f('Exo 2', [400, 500, 600, 700, 800, 900], 'Tech & Display'),
  f('Saira', [400, 500, 600, 700, 800, 900], 'Tech & Display'),
  f('Teko', [300, 400, 500, 600, 700], 'Tech & Display'),
  f('Kanit', [300, 400, 500, 600, 700, 800, 900], 'Tech & Display'),
  f('Jura', [300, 400, 500, 600, 700], 'Tech & Display'),
  f('Quantico', [400, 700], 'Tech & Display'),
  f('Play', [400, 700], 'Tech & Display'),
  f('Syncopate', [400, 700], 'Tech & Display'),
  f('Sarpanch', [400, 500, 600, 700, 800, 900], 'Tech & Display'),
  f('Turret Road', [300, 400, 500, 700, 800], 'Tech & Display'),
  f('Audiowide', [400], 'Tech & Display'),
  f('Michroma', [400], 'Tech & Display'),
  f('Aldrich', [400], 'Tech & Display'),
  f('Electrolize', [400], 'Tech & Display'),
  f('Russo One', [400], 'Tech & Display'),
  f('Black Ops One', [400], 'Tech & Display'),
  f('Bungee', [400], 'Tech & Display'),
  f('Iceland', [400], 'Tech & Display'),
  f('Zen Dots', [400], 'Tech & Display'),
  f('Days One', [400], 'Tech & Display'),
  f('Unica One', [400], 'Tech & Display'),
  f('Krona One', [400], 'Tech & Display'),
  f('Wallpoet', [400], 'Tech & Display'),
  f('Monoton', [400], 'Tech & Display'),
  // Sans
  f('Inter', [400, 500, 600, 700, 800, 900], 'Sans'),
  f('Roboto', [300, 400, 500, 700, 900], 'Sans'),
  f('Roboto Condensed', [300, 400, 700], 'Sans'),
  f('Oswald', [300, 400, 500, 600, 700], 'Sans'),
  f('Montserrat', [300, 400, 500, 600, 700, 800, 900], 'Sans'),
  f('Poppins', [300, 400, 500, 600, 700, 800, 900], 'Sans'),
  f('Barlow', [300, 400, 500, 600, 700, 800, 900], 'Sans'),
  f('Barlow Condensed', [300, 400, 500, 600, 700, 800, 900], 'Sans'),
  f('Lato', [300, 400, 700, 900], 'Sans'),
  f('Titillium Web', [300, 400, 600, 700, 900], 'Sans'),
  f('Bebas Neue', [400], 'Sans'),
  f('Anton', [400], 'Sans'),
  f('Archivo Black', [400], 'Sans'),
  // Mono
  f('Roboto Mono', [300, 400, 500, 600, 700], 'Mono'),
  f('JetBrains Mono', [400, 500, 600, 700, 800], 'Mono'),
  f('IBM Plex Mono', [300, 400, 500, 600, 700], 'Mono'),
  f('Space Mono', [400, 700], 'Mono'),
  f('Share Tech Mono', [400], 'Mono'),
  f('Nova Mono', [400], 'Mono'),
  f('Major Mono Display', [400], 'Mono'),
  f('VT323', [400], 'Mono'),
  f('Press Start 2P', [400], 'Mono'),
  f('DotGothic16', [400], 'Mono'),
  // Serif & Script
  f('Playfair Display', [400, 500, 600, 700, 800, 900], 'Serif & Script'),
  f('Cinzel', [400, 500, 600, 700, 800, 900], 'Serif & Script'),
  f('Cormorant Garamond', [300, 400, 500, 600, 700], 'Serif & Script'),
  f('Abril Fatface', [400], 'Serif & Script'),
  f('Lobster', [400], 'Serif & Script'),
  f('Pacifico', [400], 'Serif & Script'),
  f('Caveat', [400, 500, 600, 700], 'Serif & Script'),
  f('Dancing Script', [400, 500, 600, 700], 'Serif & Script'),
];

export const FONT_CATEGORIES: FontCategory[] = [
  'Tech & Display',
  'Sans',
  'Mono',
  'Serif & Script',
];

export const DEFAULT_FONT = 'Orbitron';

const WEIGHT_LABELS: Record<number, string> = {
  100: 'Thin',
  200: 'ExtraLight',
  300: 'Light',
  400: 'Regular',
  500: 'Medium',
  600: 'SemiBold',
  700: 'Bold',
  800: 'ExtraBold',
  900: 'Black',
};

/** Weights learned at runtime for families picked from the full catalog */
const dynamicWeights: Record<string, number[]> = {};

export function registerDynamicFamily(family: string, weights: number[]): void {
  dynamicWeights[family] = weights;
}

function knownWeights(family: string): number[] {
  return (
    FONTS.find((x) => x.value === family)?.weights ?? dynamicWeights[family] ?? [400, 700]
  );
}

/** Weight options available for a given family (falls back to Regular/Bold). */
export function weightsFor(family: string): { value: number; label: string }[] {
  return knownWeights(family).map((w) => ({ value: w, label: WEIGHT_LABELS[w] ?? String(w) }));
}

export function nearestWeight(family: string, weight: number): number {
  const weights = knownWeights(family);
  return weights.reduce(
    (best, w) => (Math.abs(w - weight) < Math.abs(best - weight) ? w : best),
    weights[0],
  );
}

/* ----------------------- Full Google Fonts catalog ----------------------- */

export interface CatalogFont {
  family: string;
  category: string;
  weights: number[];
}

const CAT_LABELS: Record<string, string> = {
  s: 'Sans',
  r: 'Serif',
  d: 'Display',
  h: 'Handwriting',
  m: 'Mono',
};

let catalogCache: CatalogFont[] | null = null;
let catalogPromise: Promise<CatalogFont[]> | null = null;

/** Lazy-loads the generated list of all ~1.9k Google Font families (own chunk). */
export function loadFontCatalog(): Promise<CatalogFont[]> {
  if (catalogPromise) return catalogPromise;
  catalogPromise = import('./gfonts.json').then((mod) => {
    const raw = mod.default as [string, string, number[]][];
    catalogCache = raw.map(([family, c, weights]) => ({
      family,
      category: CAT_LABELS[c] ?? 'Display',
      weights,
    }));
    for (const font of catalogCache) {
      if (!dynamicWeights[font.family]) dynamicWeights[font.family] = font.weights;
    }
    return catalogCache;
  });
  return catalogPromise;
}

// index.html has a <link> for a curated starter set, purely so first paint
// doesn't flash unstyled text — but that cross-origin <link>'s cssRules can't
// be read back by html-to-image (see injectGoogleFont), so it doesn't count
// as "loaded" here. Every family still gets inlined on first real use below.
const loaded = new Set<string>();

/**
 * Registers an uploaded TTF/OTF font via an injected @font-face rule.
 * A <style> rule (rather than the FontFace API) keeps html-to-image
 * exports working, since it inlines stylesheet-declared fonts.
 */
export function registerCustomFont(family: string, src: string): void {
  if (!family || loaded.has(family)) return;
  loaded.add(family);
  const style = document.createElement('style');
  style.setAttribute('data-sylar-font', family);
  style.textContent = `@font-face{font-family:'${family.replace(/'/g, '')}';src:url(${src});font-display:swap;}`;
  document.head.appendChild(style);
}

/**
 * Loads the Google Font CSS ourselves and inlines it as a <style> tag rather
 * than a <link>. A cross-origin <link>'s cssRules can't be read back by JS
 * (SecurityError), which makes html-to-image silently fail to embed the font
 * when baking PNGs — text bakes with a fallback font even though the font
 * displays fine on-screen and in native (non-baked) text widgets. An inlined
 * same-origin <style> has readable cssRules, so baking works too.
 */
async function injectGoogleFont(family: string, weights: number[]): Promise<void> {
  const sorted = [...weights].sort((a, b) => a - b);
  const axis = sorted.length > 1 || sorted[0] !== 400 ? `:wght@${sorted.join(';')}` : '';
  const url = `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, '+')}${axis}&display=swap`;
  try {
    const res = await fetch(url);
    const css = await res.text();
    const style = document.createElement('style');
    style.setAttribute('data-sylar-font', family);
    style.textContent = css;
    document.head.appendChild(style);
  } catch {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = url;
    document.head.appendChild(link);
  }
}

/** Injects the Google Fonts stylesheet for a family exactly once. */
export function ensureFontLoaded(family: string): void {
  if (!family || loaded.has(family)) return;
  loaded.add(family);
  const weights = FONTS.find((x) => x.value === family)?.weights ?? dynamicWeights[family];
  if (weights) {
    void injectGoogleFont(family, weights);
    return;
  }
  // Unknown family (e.g. project saved with a catalog font, fresh session):
  // look up its exact weights so the css2 request cannot 400.
  loadFontCatalog().then((catalog) => {
    const entry = catalog.find((x) => x.family === family);
    injectGoogleFont(family, entry?.weights ?? [400]);
  });
}

/** Every family loaded so far this session (Google + custom uploads). */
export function loadedFontFamilies(): string[] {
  return [...loaded];
}
