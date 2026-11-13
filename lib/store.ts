// The app's storage front door. Pages call these functions and never touch a database directly.
// Signed out, scenes live in this browser (lib/local.ts). Signed in, new scenes go to the cloud
// (lib/cloud.ts). A scene's id says where it lives: cloud ids are UUIDs and contain dashes.
import * as local from './local';
import * as cloud from './cloud';

export type Project = {
  id: string;
  name: string;
  data: any;
  thumb?: string;
  isPublic?: boolean;
  where?: 'local' | 'cloud';
  createdAt: number;
  updatedAt: number;
};

export const isCloudId = (id: string) => id.includes('-');
const side = (id: string) => (isCloudId(id) ? cloud : local);

// ----- account -----
export async function currentEmail(): Promise<string | null> {
  const { data } = await cloud.supabase().auth.getSession();
  return data.session ? data.session.user.email || 'Signed in' : null;
}
export async function signIn(email: string, password: string): Promise<string | null> {
  const { error } = await cloud.supabase().auth.signInWithPassword({ email, password });
  return error ? error.message : null;
}
// Returns a message to show. New accounts may need to confirm by email before signing in.
export async function signUp(email: string, password: string): Promise<{ error?: string; needsConfirm?: boolean }> {
  const { data, error } = await cloud.supabase().auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
  if (error) return { error: error.message };
  return { needsConfirm: !data.session };
}
export async function signOut(): Promise<void> {
  await cloud.supabase().auth.signOut();
}

// ----- scenes -----
export async function listProjects(): Promise<Project[]> {
  const [mine, here] = await Promise.all([cloud.listProjects().catch(() => [] as Project[]), local.listProjects()]);
  return [...mine, ...here].sort((a, b) => b.updatedAt - a.updatedAt);
}
export const getProject = (id: string) => side(id).getProject(id);
export const saveProject = (p: Project) => side(p.id).saveProject(p);
export const deleteProject = (id: string) => side(id).deleteProject(id);
export const putAsset = (projectId: string, name: string, buf: ArrayBuffer) => side(projectId).putAsset(projectId, name, buf);
export const getAssets = (projectId: string) => side(projectId).getAssets(projectId);

export async function createProject(name: string, data: any): Promise<Project> {
  return (await cloud.userId()) ? cloud.createProject(name, data) : local.createProject(name, data);
}

// Copies a scene and its models. The copy lands in the cloud when signed in, otherwise in this browser.
export async function duplicateProject(id: string, name?: string): Promise<Project | null> {
  const src = await getProject(id);
  if (!src) return null;
  const copy = await createProject(name || src.name + ' copy', JSON.parse(JSON.stringify(src.data)));
  if (src.thumb) await saveProject({ ...copy, thumb: src.thumb });
  const assets = await getAssets(id);
  for (const [file, buf] of assets) await putAsset(copy.id, file, buf);
  return copy;
}
