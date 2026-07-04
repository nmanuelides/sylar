import { create } from 'zustand';

const LS_KEY = 'sylar:colorHistory';
const MAX_RECENT = 5;

export const isValidColor = (c: string): boolean => {
  const v = c.trim();
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(v) || v.toLowerCase().startsWith('rgb');
};

const normalize = (c: string): string => c.trim().toLowerCase();

interface Stored {
  recent: string[];
  favorites: string[];
}

function load(): Stored {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_KEY) ?? '{}') as Partial<Stored>;
    return {
      recent: Array.isArray(raw.recent) ? raw.recent : [],
      favorites: Array.isArray(raw.favorites) ? raw.favorites : [],
    };
  } catch {
    return { recent: [], favorites: [] };
  }
}

function persist(state: Stored): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  } catch {
    /* storage full/unavailable — non-critical */
  }
}

interface ColorHistoryState extends Stored {
  addRecent: (color: string) => void;
  toggleFavorite: (color: string) => void;
}

export const useColorHistory = create<ColorHistoryState>((set, get) => ({
  ...load(),
  addRecent: (color) => {
    if (!isValidColor(color)) return;
    const c = normalize(color);
    set((s) => {
      if (s.favorites.includes(c)) return {}; // already always shown, no need to duplicate in recents
      const recent = [c, ...s.recent.filter((x) => x !== c)].slice(0, MAX_RECENT);
      persist({ recent, favorites: s.favorites });
      return { recent };
    });
  },
  toggleFavorite: (color) => {
    if (!isValidColor(color)) return;
    const c = normalize(color);
    const { favorites, recent } = get();
    const nextFavorites = favorites.includes(c)
      ? favorites.filter((x) => x !== c)
      : [...favorites, c];
    const nextRecent = nextFavorites.includes(c) ? recent.filter((x) => x !== c) : recent;
    persist({ recent: nextRecent, favorites: nextFavorites });
    set({ favorites: nextFavorites, recent: nextRecent });
  },
}));
