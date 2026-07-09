import { create } from 'zustand';
import type {
  AssetItem,
  CustomFontItem,
  EditorMode,
  ThemeColor,
  WatchElement,
  WatchfaceProject,
} from '@/types/watchface';
import { DEFAULT_DEVICE_ID, getDevice } from '@/data/devices';
import { starterElements } from '@/data/library';
import { projectId, uid } from '@/lib/uid';
import { clamp, resolvePivot } from '@/lib/geometry';
import type { Language } from '@/lib/i18n';

interface Snapshot {
  normal: WatchElement[];
  aod: WatchElement[];
  backgroundColor: string;
  aodBackgroundColor: string;
  assets: AssetItem[];
  theme: ThemeColor[];
  themeBindings: Record<string, string>;
}

export type AlignKind = 'left' | 'centerH' | 'right' | 'top' | 'centerV' | 'bottom';

/** Binding key for an element's color property — used to link it to a theme color. */
export const elementBindingKey = (elementId: string, propKey: string): string =>
  `el:${elementId}:${propKey}`;

/** Binding key for the canvas background of a given editor mode. */
export const backgroundBindingKey = (mode: EditorMode): string =>
  mode === 'normal' ? 'bg:normal' : 'bg:aod';

export function createProject(
  deviceId: string = DEFAULT_DEVICE_ID,
  name = 'Untitled watchface',
): WatchfaceProject {
  const device = getDevice(deviceId);
  const now = new Date().toISOString();
  return {
    id: projectId(),
    name,
    deviceId,
    backgroundColor: '#060d18',
    aodBackgroundColor: '#000000',
    normal: starterElements(device),
    aod: [],
    assets: [],
    fonts: [],
    theme: [
      { id: uid(), name: 'Accent', color: '#4fc3ff' },
      { id: uid(), name: 'Text', color: '#eaf6ff' },
      { id: uid(), name: 'Muted', color: '#547499' },
    ],
    themeBindings: {},
    createdAt: now,
    updatedAt: now,
  };
}

/** Projects saved/imported before the theme feature existed have no `theme` — seed the same defaults. */
function withDefaultTheme(project: WatchfaceProject): WatchfaceProject {
  if (project.theme && project.theme.length > 0) return project;
  return {
    ...project,
    theme: [
      { id: uid(), name: 'Accent', color: '#4fc3ff' },
      { id: uid(), name: 'Text', color: '#eaf6ff' },
      { id: uid(), name: 'Muted', color: '#547499' },
    ],
    themeBindings: project.themeBindings ?? {},
  };
}

/** Writes `color` into whatever a binding key points at (an element property or a canvas background). */
function applyBindingColor(
  project: WatchfaceProject,
  bindingKey: string,
  color: string,
): WatchfaceProject {
  if (bindingKey === backgroundBindingKey('normal')) return { ...project, backgroundColor: color };
  if (bindingKey === backgroundBindingKey('aod')) return { ...project, aodBackgroundColor: color };
  const match = bindingKey.match(/^el:([^:]+):(.+)$/);
  if (!match) return project;
  const [, elId, propKey] = match;
  const patchArr = (arr: WatchElement[]): WatchElement[] =>
    arr.map((el) => (el.id === elId ? ({ ...el, [propKey]: color } as WatchElement) : el));
  return { ...project, normal: patchArr(project.normal), aod: patchArr(project.aod) };
}

interface EditorStore {
  project: WatchfaceProject;
  mode: EditorMode;
  selectedIds: string[];
  zoom: number;
  showGrid: boolean;
  snap: boolean;
  gridSize: number;
  dirty: boolean;
  past: Snapshot[];
  future: Snapshot[];
  previewOpen: boolean;
  exportOpen: boolean;
  mockDataOpen: boolean;
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;

  setProject: (p: WatchfaceProject) => void;
  newProject: (deviceId?: string, name?: string) => void;
  renameProject: (name: string) => void;
  setDevice: (deviceId: string) => void;
  setLanguage: (language: Language | undefined) => void;
  setStepsGoal: (goal: number | undefined) => void;
  setBackground: (color: string) => void;
  setMode: (mode: EditorMode) => void;
  setZoom: (zoom: number) => void;
  toggleGrid: () => void;
  toggleSnap: () => void;
  setGridSize: (size: number) => void;
  setDirty: (dirty: boolean) => void;
  setPreviewOpen: (open: boolean) => void;
  setExportOpen: (open: boolean) => void;
  setMockDataOpen: (open: boolean) => void;
  setLeftPanelOpen: (open: boolean) => void;
  setRightPanelOpen: (open: boolean) => void;

  addThemeColor: (name: string, color: string) => void;
  renameThemeColor: (themeId: string, name: string) => void;
  setThemeColor: (themeId: string, color: string) => void;
  removeThemeColor: (themeId: string) => void;
  bindToTheme: (bindingKey: string, themeId: string) => void;
  unbindTheme: (bindingKey: string) => void;

  select: (ids: string[]) => void;
  toggleSelect: (id: string) => void;
  clearSelection: () => void;

  commit: () => void;
  undo: () => void;
  redo: () => void;

  addElement: (el: WatchElement) => void;
  updateElements: (
    ids: string[],
    patch: Partial<WatchElement> | ((el: WatchElement) => Partial<WatchElement>),
  ) => void;
  removeElements: (ids: string[]) => void;
  duplicateSelected: () => void;
  setOrder: (orderedIds: string[]) => void;
  toggleVisible: (id: string) => void;
  toggleLocked: (id: string) => void;
  alignSelected: (kind: AlignKind) => void;
  nudgeSelected: (dx: number, dy: number) => void;
  copyNormalToAod: () => void;

  addAsset: (asset: AssetItem) => void;
  removeAsset: (id: string) => void;
  addFont: (font: CustomFontItem) => void;
  removeFont: (id: string) => void;
}

const modeKey = (mode: EditorMode): 'normal' | 'aod' => (mode === 'normal' ? 'normal' : 'aod');

const snap = (s: { project: WatchfaceProject }): Snapshot =>
  structuredClone({
    normal: s.project.normal,
    aod: s.project.aod,
    backgroundColor: s.project.backgroundColor,
    aodBackgroundColor: s.project.aodBackgroundColor,
    assets: s.project.assets,
    theme: s.project.theme ?? [],
    themeBindings: s.project.themeBindings ?? {},
  });

const applySnap = (p: WatchfaceProject, s: Snapshot): WatchfaceProject => ({
  ...p,
  ...structuredClone(s),
  updatedAt: new Date().toISOString(),
});

export const useEditor = create<EditorStore>((set, get) => ({
  project: createProject(),
  mode: 'normal',
  selectedIds: [],
  zoom: 1,
  showGrid: true,
  snap: true,
  gridSize: 10,
  dirty: false,
  past: [],
  future: [],
  previewOpen: false,
  exportOpen: false,
  mockDataOpen: false,
  leftPanelOpen: true,
  rightPanelOpen: true,

  setProject: (p) =>
    set({
      project: withDefaultTheme(p),
      mode: 'normal',
      selectedIds: [],
      past: [],
      future: [],
      dirty: false,
    }),
  newProject: (deviceId, name) =>
    set({
      project: createProject(deviceId, name),
      mode: 'normal',
      selectedIds: [],
      past: [],
      future: [],
      dirty: false,
    }),
  renameProject: (name) =>
    set((s) => ({ project: { ...s.project, name }, dirty: true })),
  setDevice: (deviceId) =>
    set((s) => ({ project: { ...s.project, deviceId }, dirty: true })),
  setLanguage: (language) =>
    set((s) => ({ project: { ...s.project, language }, dirty: true })),
  setStepsGoal: (stepsGoal) =>
    set((s) => ({ project: { ...s.project, stepsGoal }, dirty: true })),
  setBackground: (color) =>
    set((s) => ({
      project:
        s.mode === 'normal'
          ? { ...s.project, backgroundColor: color }
          : { ...s.project, aodBackgroundColor: color },
      dirty: true,
    })),
  setMode: (mode) => set({ mode, selectedIds: [] }),
  setZoom: (zoom) => set({ zoom: clamp(Math.round(zoom * 100) / 100, 0.15, 8) }),
  toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
  toggleSnap: () => set((s) => ({ snap: !s.snap })),
  setGridSize: (size) => set({ gridSize: clamp(Math.round(size), 2, 100) }),
  setDirty: (dirty) => set({ dirty }),
  setPreviewOpen: (previewOpen) => set({ previewOpen }),
  setExportOpen: (exportOpen) => set({ exportOpen }),
  setMockDataOpen: (mockDataOpen) => set({ mockDataOpen }),
  setLeftPanelOpen: (leftPanelOpen) => set({ leftPanelOpen }),
  setRightPanelOpen: (rightPanelOpen) => set({ rightPanelOpen }),

  select: (ids) => set({ selectedIds: ids }),
  toggleSelect: (id) =>
    set((s) => ({
      selectedIds: s.selectedIds.includes(id)
        ? s.selectedIds.filter((i) => i !== id)
        : [...s.selectedIds, id],
    })),
  clearSelection: () => set({ selectedIds: [] }),

  commit: () =>
    set((s) => ({ past: [...s.past.slice(-59), snap(s)], future: [] })),
  undo: () =>
    set((s) => {
      const prev = s.past[s.past.length - 1];
      if (!prev) return {};
      return {
        past: s.past.slice(0, -1),
        future: [snap(s), ...s.future.slice(0, 59)],
        project: applySnap(s.project, prev),
        selectedIds: [],
        dirty: true,
      };
    }),
  redo: () =>
    set((s) => {
      const next = s.future[0];
      if (!next) return {};
      return {
        future: s.future.slice(1),
        past: [...s.past, snap(s)],
        project: applySnap(s.project, next),
        selectedIds: [],
        dirty: true,
      };
    }),

  addElement: (el) =>
    set((s) => {
      const key = modeKey(s.mode);
      return {
        past: [...s.past.slice(-59), snap(s)],
        future: [],
        project: {
          ...s.project,
          [key]: [...s.project[key], el],
          updatedAt: new Date().toISOString(),
        },
        selectedIds: [el.id],
        dirty: true,
      };
    }),
  updateElements: (ids, patch) =>
    set((s) => {
      const key = modeKey(s.mode);
      const arr = s.project[key].map((el) =>
        ids.includes(el.id)
          ? ({ ...el, ...(typeof patch === 'function' ? patch(el) : patch) } as WatchElement)
          : el,
      );
      return {
        project: { ...s.project, [key]: arr, updatedAt: new Date().toISOString() },
        dirty: true,
      };
    }),
  removeElements: (ids) =>
    set((s) => {
      if (ids.length === 0) return {};
      const key = modeKey(s.mode);
      const remaining = s.project[key]
        .filter((el) => !ids.includes(el.id))
        .map((el) =>
          el.pivotTargetId && ids.includes(el.pivotTargetId)
            ? { ...el, pivotTargetId: undefined }
            : el,
        );
      return {
        past: [...s.past.slice(-59), snap(s)],
        future: [],
        project: {
          ...s.project,
          [key]: remaining,
          updatedAt: new Date().toISOString(),
        },
        selectedIds: s.selectedIds.filter((id) => !ids.includes(id)),
        dirty: true,
      };
    }),
  duplicateSelected: () =>
    set((s) => {
      const key = modeKey(s.mode);
      const clones = s.project[key]
        .filter((el) => s.selectedIds.includes(el.id))
        .map((el) => ({
          ...structuredClone(el),
          id: uid(),
          name: `${el.name} copy`,
          x: el.x + 16,
          y: el.y + 16,
        }));
      if (clones.length === 0) return {};
      return {
        past: [...s.past.slice(-59), snap(s)],
        future: [],
        project: {
          ...s.project,
          [key]: [...s.project[key], ...clones],
          updatedAt: new Date().toISOString(),
        },
        selectedIds: clones.map((c) => c.id),
        dirty: true,
      };
    }),
  setOrder: (orderedIds) =>
    set((s) => {
      const key = modeKey(s.mode);
      const byId = new Map(s.project[key].map((el) => [el.id, el]));
      const arr = orderedIds
        .map((id) => byId.get(id))
        .filter((el): el is WatchElement => !!el);
      if (arr.length !== s.project[key].length) return {};
      return {
        project: { ...s.project, [key]: arr, updatedAt: new Date().toISOString() },
        dirty: true,
      };
    }),
  toggleVisible: (id) =>
    get().updateElements([id], (el) => ({ visible: !el.visible })),
  toggleLocked: (id) =>
    get().updateElements([id], (el) => ({ locked: !el.locked })),
  alignSelected: (kind) => {
    const s = get();
    const elements = selectCurrentElements(s);
    // selectedIds preserves click order — the first selected element is the anchor
    const selected = s.selectedIds
      .map((id) => elements.find((el) => el.id === id))
      .filter((el): el is WatchElement => !!el);
    if (selected.length === 0) return;
    s.commit();

    if (selected.length === 1) {
      // Single selection aligns to the watchface canvas
      const device = getDevice(s.project.deviceId);
      s.updateElements(s.selectedIds, (el) => {
        switch (kind) {
          case 'left':
            return { x: el.width / 2 };
          case 'centerH':
            // For images the pivot (not the box) lands on center — hand assets need this
            return { x: device.width / 2 - (resolvePivot(el, elements).x - el.x) };
          case 'right':
            return { x: device.width - el.width / 2 };
          case 'top':
            return { y: el.height / 2 };
          case 'centerV':
            return { y: device.height / 2 - (resolvePivot(el, elements).y - el.y) };
          case 'bottom':
            return { y: device.height - el.height / 2 };
        }
      });
      return;
    }

    // Multi-selection aligns everything to the anchor element's box
    const anchor = selected[0];
    const left = anchor.x - anchor.width / 2;
    const right = anchor.x + anchor.width / 2;
    const top = anchor.y - anchor.height / 2;
    const bottom = anchor.y + anchor.height / 2;
    s.updateElements(s.selectedIds, (el) => {
      if (el.id === anchor.id || el.locked) return {};
      switch (kind) {
        case 'left':
          return { x: left + el.width / 2 };
        case 'centerH':
          return { x: anchor.x };
        case 'right':
          return { x: right - el.width / 2 };
        case 'top':
          return { y: top + el.height / 2 };
        case 'centerV':
          return { y: anchor.y };
        case 'bottom':
          return { y: bottom - el.height / 2 };
      }
    });
  },
  nudgeSelected: (dx, dy) => {
    const s = get();
    if (s.selectedIds.length === 0) return;
    s.updateElements(s.selectedIds, (el) =>
      el.locked ? {} : { x: el.x + dx, y: el.y + dy },
    );
  },
  copyNormalToAod: () =>
    set((s) => {
      // Preserve pivotTargetId relationships across the copy — an AOD hand
      // pivoting on an AOD dial-center element should stay bound to its AOD
      // counterpart, not the normal-mode id it can never resolve in AOD mode.
      const idMap = new Map(s.project.normal.map((el) => [el.id, uid()]));
      const aod = s.project.normal.map((el) => {
        const clone = { ...structuredClone(el), id: idMap.get(el.id)! };
        if (clone.pivotTargetId) {
          clone.pivotTargetId = idMap.get(clone.pivotTargetId);
        }
        return clone;
      });
      return {
        past: [...s.past.slice(-59), snap(s)],
        future: [],
        project: {
          ...s.project,
          aod,
          updatedAt: new Date().toISOString(),
        },
        dirty: true,
      };
    }),

  addAsset: (asset) =>
    set((s) => ({
      project: {
        ...s.project,
        assets: [...s.project.assets, asset],
        updatedAt: new Date().toISOString(),
      },
      dirty: true,
    })),
  removeAsset: (id) =>
    set((s) => ({
      project: {
        ...s.project,
        assets: s.project.assets.filter((a) => a.id !== id),
        updatedAt: new Date().toISOString(),
      },
      dirty: true,
    })),
  addThemeColor: (name, color) =>
    set((s) => ({
      project: {
        ...s.project,
        theme: [...(s.project.theme ?? []), { id: uid(), name, color }],
        updatedAt: new Date().toISOString(),
      },
      dirty: true,
    })),
  renameThemeColor: (themeId, name) =>
    set((s) => ({
      project: {
        ...s.project,
        theme: (s.project.theme ?? []).map((t) => (t.id === themeId ? { ...t, name } : t)),
        updatedAt: new Date().toISOString(),
      },
      dirty: true,
    })),
  setThemeColor: (themeId, color) =>
    set((s) => {
      const theme = (s.project.theme ?? []).map((t) => (t.id === themeId ? { ...t, color } : t));
      let project: WatchfaceProject = { ...s.project, theme };
      for (const [bindingKey, boundThemeId] of Object.entries(s.project.themeBindings ?? {})) {
        if (boundThemeId === themeId) project = applyBindingColor(project, bindingKey, color);
      }
      return { project: { ...project, updatedAt: new Date().toISOString() }, dirty: true };
    }),
  removeThemeColor: (themeId) =>
    set((s) => {
      const themeBindings = { ...(s.project.themeBindings ?? {}) };
      for (const key of Object.keys(themeBindings)) {
        if (themeBindings[key] === themeId) delete themeBindings[key];
      }
      return {
        project: {
          ...s.project,
          theme: (s.project.theme ?? []).filter((t) => t.id !== themeId),
          themeBindings,
          updatedAt: new Date().toISOString(),
        },
        dirty: true,
      };
    }),
  bindToTheme: (bindingKey, themeId) =>
    set((s) => {
      const themeColor = (s.project.theme ?? []).find((t) => t.id === themeId);
      if (!themeColor) return {};
      const themeBindings = { ...(s.project.themeBindings ?? {}), [bindingKey]: themeId };
      const project = applyBindingColor(
        { ...s.project, themeBindings },
        bindingKey,
        themeColor.color,
      );
      return { project: { ...project, updatedAt: new Date().toISOString() }, dirty: true };
    }),
  unbindTheme: (bindingKey) =>
    set((s) => {
      const themeBindings = { ...(s.project.themeBindings ?? {}) };
      delete themeBindings[bindingKey];
      return {
        project: { ...s.project, themeBindings, updatedAt: new Date().toISOString() },
        dirty: true,
      };
    }),
  addFont: (font) =>
    set((s) => ({
      project: {
        ...s.project,
        fonts: [...(s.project.fonts ?? []), font],
        updatedAt: new Date().toISOString(),
      },
      dirty: true,
    })),
  removeFont: (id) =>
    set((s) => ({
      project: {
        ...s.project,
        fonts: (s.project.fonts ?? []).filter((f) => f.id !== id),
        updatedAt: new Date().toISOString(),
      },
      dirty: true,
    })),
}));

/** Elements of the currently edited mode (normal or AOD) */
export const selectCurrentElements = (s: EditorStore): WatchElement[] =>
  s.mode === 'normal' ? s.project.normal : s.project.aod;

export const selectBackground = (s: EditorStore): string =>
  s.mode === 'normal' ? s.project.backgroundColor : s.project.aodBackgroundColor;
