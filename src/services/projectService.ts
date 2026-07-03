import { createStore, del, entries, get, set } from 'idb-keyval';
import { getSupabase } from '@/lib/supabase';
import type { ProjectSummary, WatchfaceProject } from '@/types/watchface';

/**
 * Local persistence lives in IndexedDB — embedded image/font data URLs make
 * projects far too large for localStorage's ~5 MB quota.
 */
interface LocalRecord {
  project: WatchfaceProject;
  thumbnail?: string;
}

const idb = createStore('sylar-studio', 'watchfaces');

// Pre-IndexedDB versions stored everything in these localStorage keys
const LS_KEY = 'sylar:watchfaces';
const LS_THUMBS = 'sylar:thumbnails';

let migration: Promise<void> | null = null;

function migrateFromLocalStorage(): Promise<void> {
  migration ??= (async () => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      const projects = JSON.parse(raw) as Record<string, WatchfaceProject>;
      let thumbs: Record<string, string> = {};
      try {
        thumbs = JSON.parse(localStorage.getItem(LS_THUMBS) ?? '{}') as Record<string, string>;
      } catch {
        /* thumbnails are optional */
      }
      await Promise.all(
        Object.values(projects).map((p) =>
          set(p.id, { project: p, thumbnail: thumbs[p.id] } satisfies LocalRecord, idb),
        ),
      );
      localStorage.removeItem(LS_KEY);
      localStorage.removeItem(LS_THUMBS);
    } catch {
      /* best effort — worst case old data stays in localStorage untouched */
    }
  })();
  return migration;
}

export async function listProjects(): Promise<ProjectSummary[]> {
  const sb = getSupabase();
  if (sb) {
    const { data, error } = await sb
      .from('watchfaces')
      .select('id, name, device_id, updated_at, thumbnail')
      .order('updated_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => ({
      id: r.id as string,
      name: r.name as string,
      deviceId: r.device_id as string,
      updatedAt: r.updated_at as string,
      thumbnail: (r.thumbnail as string | null) ?? undefined,
    }));
  }
  await migrateFromLocalStorage();
  const records = await entries<string, LocalRecord>(idb);
  return records
    .map(([, record]) => ({
      id: record.project.id,
      name: record.project.name,
      deviceId: record.project.deviceId,
      updatedAt: record.project.updatedAt,
      thumbnail: record.thumbnail,
      // full data is local anyway — lets the gallery render live previews
      project: record.project,
    }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function loadProject(id: string): Promise<WatchfaceProject | null> {
  const sb = getSupabase();
  if (sb) {
    const { data, error } = await sb.from('watchfaces').select('data').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    return (data?.data as WatchfaceProject | undefined) ?? null;
  }
  await migrateFromLocalStorage();
  return (await get<LocalRecord>(id, idb))?.project ?? null;
}

export async function saveProject(project: WatchfaceProject, thumbnail?: string): Promise<void> {
  const updated: WatchfaceProject = { ...project, updatedAt: new Date().toISOString() };
  const sb = getSupabase();
  if (sb) {
    const { error } = await sb.from('watchfaces').upsert({
      id: updated.id,
      name: updated.name,
      device_id: updated.deviceId,
      data: updated,
      thumbnail: thumbnail ?? null,
      updated_at: updated.updatedAt,
    });
    if (error) throw new Error(error.message);
    return;
  }
  await migrateFromLocalStorage();
  const previous = await get<LocalRecord>(updated.id, idb);
  await set(
    updated.id,
    { project: updated, thumbnail: thumbnail ?? previous?.thumbnail } satisfies LocalRecord,
    idb,
  );
}

export async function deleteProject(id: string): Promise<void> {
  const sb = getSupabase();
  if (sb) {
    const { error } = await sb.from('watchfaces').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return;
  }
  await migrateFromLocalStorage();
  await del(id, idb);
}

export async function duplicateProject(id: string): Promise<WatchfaceProject | null> {
  const src = await loadProject(id);
  if (!src) return null;
  const thumbnail = getSupabase() ? undefined : (await get<LocalRecord>(id, idb))?.thumbnail;
  const copy: WatchfaceProject = {
    ...structuredClone(src),
    id: crypto.randomUUID(),
    name: `${src.name} copy`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await saveProject(copy, thumbnail);
  return copy;
}
