/** Short id for elements/assets */
export const uid = (): string =>
  Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 6);

/** UUID for projects (Supabase primary key) */
export const projectId = (): string => crypto.randomUUID();
