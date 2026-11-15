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

export async function me(): Promise<{ id: string; email: string } | null> {
  const { data } = await supabase().auth.getSession();
  return data.session ? { id: data.session.user.id, email: (data.session.user.email || '').toLowerCase() } : null;
}

// Scenes other people have shared with this account.
export async function sharedProjects(): Promise<Project[]> {
  const who = await me();
  if (!who || !who.email) return [];
  const mine = check(await supabase().from('project_members').select('project_id').eq('email', who.email));
  const ids = (mine || []).map((m: any) => m.project_id);
  if (!ids.length) return [];
  const rows = check(await supabase().from('projects').select(LIST_COLUMNS + ',owner').in('id', ids).order('updated_at', { ascending: false }));
  return (rows || []).filter((r: any) => r.owner !== who.id).map((r: any) => ({ ...toProject(r), shared: true }));
}

// ----- sharing -----
export async function isOwner(projectId: string): Promise<boolean> {
  const who = await me();
  if (!who) return false;
  const row = check(await supabase().from('projects').select('owner').eq('id', projectId).maybeSingle());
  return !!row && (row as any).owner === who.id;
}
export async function listMembers(projectId: string): Promise<string[]> {
  return (check(await supabase().from('project_members').select('email').eq('project_id', projectId).order('added_at')) || []).map((m: any) => m.email);
}
export async function addMember(projectId: string, email: string): Promise<void> {
  check(await supabase().from('project_members').upsert({ project_id: projectId, email: email.trim().toLowerCase() }).select('email'));
}
export async function removeMember(projectId: string, email: string): Promise<void> {
  check(await supabase().from('project_members').delete().eq('project_id', projectId).eq('email', email).select('email'));
}

// ----- comments -----
export type Comment = { id: string; author: string; authorEmail: string; body: string; objectId: string | null; resolved: boolean; createdAt: number };
export async function listComments(projectId: string): Promise<Comment[]> {
  const rows = check(await supabase().from('comments').select('*').eq('project_id', projectId).order('created_at'));
  return (rows || []).map((c: any) => ({ id: c.id, author: c.author, authorEmail: c.author_email, body: c.body, objectId: c.object_id, resolved: !!c.resolved, createdAt: Date.parse(c.created_at) }));
}
export async function addComment(projectId: string, body: string, objectId: string | null): Promise<void> {
  check(await supabase().from('comments').insert({ project_id: projectId, body: body.trim().slice(0, 1000), object_id: objectId }).select('id'));
}
export async function resolveComment(id: string, resolved: boolean): Promise<void> {
  check(await supabase().from('comments').update({ resolved }).eq('id', id).select('id'));
}
export async function deleteComment(id: string): Promise<void> {
  check(await supabase().from('comments').delete().eq('id', id).select('id'));
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

const TYPES: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml', mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime' };
async function assetNames(projectId: string): Promise<string[]> {
  const files = check(await supabase().storage.from('assets').list(projectId, { limit: 200 }));
  return (files || []).map((f) => f.name);
}

export async function putAsset(projectId: string, name: string, buf: ArrayBuffer): Promise<void> {
  check(await supabase().storage.from('assets').upload(projectId + '/' + name, new Blob([buf]), { upsert: true, contentType: TYPES[(name.split('.').pop() || '').toLowerCase()] || 'model/gltf-binary' }));
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
