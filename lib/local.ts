// Local storage: scenes kept in this browser's IndexedDB. Used when nobody is signed in.
import type { Project } from './store';

type Asset = { key: string; projectId: string; name: string; buf: ArrayBuffer };

const DB_NAME = 'wonderfull';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      db.createObjectStore('projects', { keyPath: 'id' });
      db.createObjectStore('assets', { keyPath: 'key' }).createIndex('projectId', 'projectId');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(store: 'projects' | 'assets', mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const req = fn(tx.objectStore(store));
    tx.oncomplete = () => { db.close(); resolve(req.result); };
    tx.onerror = () => { db.close(); reject(tx.error); };
    tx.onabort = () => { db.close(); reject(tx.error); };
  });
}

export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export async function listProjects(): Promise<Project[]> {
  const all = await run<Project[]>('projects', 'readonly', (s) => s.getAll());
  return all.map((p) => ({ ...p, where: 'local' as const })).sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getProject(id: string): Promise<Project | null> {
  return (await run<Project | undefined>('projects', 'readonly', (s) => s.get(id))) || null;
}

export async function saveProject(project: Project): Promise<void> {
  await run('projects', 'readwrite', (s) => s.put(project));
}

export async function createProject(name: string, data: any): Promise<Project> {
  const now = Date.now();
  const project: Project = { id: newId(), name, data, where: 'local', createdAt: now, updatedAt: now };
  await saveProject(project);
  return project;
}

async function assetsOf(projectId: string): Promise<Asset[]> {
  return run<Asset[]>('assets', 'readonly', (s) => s.index('projectId').getAll(projectId));
}

export async function putAsset(projectId: string, name: string, buf: ArrayBuffer): Promise<void> {
  await run('assets', 'readwrite', (s) => s.put({ key: projectId + '/' + name, projectId, name, buf }));
}

// Imported models for a project, keyed by file name.
export async function getAssets(projectId: string): Promise<Map<string, ArrayBuffer>> {
  const map = new Map<string, ArrayBuffer>();
  (await assetsOf(projectId)).forEach((a) => map.set(a.name, a.buf));
  return map;
}

export async function deleteProject(id: string): Promise<void> {
  const assets = await assetsOf(id);
  for (const a of assets) await run('assets', 'readwrite', (s) => s.delete(a.key));
  await run('projects', 'readwrite', (s) => s.delete(id));
}
