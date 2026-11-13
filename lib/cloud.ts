// Cloud storage: scenes in the Supabase "projects" table, imported models in the "assets" bucket.
// Row level security limits each account to its own scenes; published scenes are readable by anyone.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_KEY, SUPABASE_URL } from './config';
import type { Project } from './store';

let client: SupabaseClient | null = null;
export function supabase(): SupabaseClient {
  if (!client) client = createClient(SUPABASE_URL, SUPABASE_KEY);
  return client;
}

const LIST_COLUMNS = 'id,name,thumb,is_public,created_at,updated_at';

function toProject(row: any): Project {
  return {
    id: row.id,
    name: row.name,
    data: row.data,
    thumb: row.thumb || undefined,
    isPublic: !!row.is_public,
    where: 'cloud',
    createdAt: Date.parse(row.created_at),
    updatedAt: Date.parse(row.updated_at),
  };
}
function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

export async function userId(): Promise<string | null> {
  const { data } = await supabase().auth.getSession();
  return data.session ? data.session.user.id : null;
}

export async function listProjects(): Promise<Project[]> {
  const uid = await userId();
  if (!uid) return [];
  const rows = check(await supabase().from('projects').select(LIST_COLUMNS).eq('owner', uid).order('updated_at', { ascending: false }));
  return (rows || []).map(toProject);
}

export async function getProject(id: string): Promise<Project | null> {
  const row = check(await supabase().from('projects').select('*').eq('id', id).maybeSingle());
  return row ? toProject(row) : null;
}

export async function createProject(name: string, data: any): Promise<Project> {
  return toProject(check(await supabase().from('projects').insert({ name, data }).select().single()));
}

export async function saveProject(p: Project): Promise<void> {
  check(await supabase().from('projects')
    .update({ name: p.name, data: p.data, thumb: p.thumb || null, is_public: !!p.isPublic, updated_at: new Date().toISOString() })
    .eq('id', p.id).select('id'));
}

async function assetNames(projectId: string): Promise<string[]> {
  const files = check(await supabase().storage.from('assets').list(projectId, { limit: 200 }));
  return (files || []).map((f) => f.name);
}

export async function putAsset(projectId: string, name: string, buf: ArrayBuffer): Promise<void> {
  check(await supabase().storage.from('assets').upload(projectId + '/' + name, new Blob([buf]), { upsert: true, contentType: 'model/gltf-binary' }));
}

export async function getAssets(projectId: string): Promise<Map<string, ArrayBuffer>> {
  const map = new Map<string, ArrayBuffer>();
  for (const name of await assetNames(projectId)) {
    const blob = check(await supabase().storage.from('assets').download(projectId + '/' + name));
    if (blob) map.set(name, await blob.arrayBuffer());
  }
  return map;
}

export async function deleteProject(id: string): Promise<void> {
  const names = await assetNames(id);
  if (names.length) check(await supabase().storage.from('assets').remove(names.map((n) => id + '/' + n)));
  check(await supabase().from('projects').delete().eq('id', id).select('id'));
}
