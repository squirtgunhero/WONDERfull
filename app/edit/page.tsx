'use client';
import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Editor } from '../../components/editor/Editor';
import { Wordmark } from '../../components/Wordmark';
import { getAssets, getProject, isCloudId, putAsset, saveProject, type Project } from '../../lib/store';

type Loaded = { project: Project; buffers: Map<string, ArrayBuffer> };

function EditScene() {
  const id = useSearchParams().get('id');
  const cloud = !!id && isCloudId(id);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [missing, setMissing] = useState(false);
  const [name, setName] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [status, setStatus] = useState('Saved');
  // Saves run one after another so a rename and a scene save never overwrite each other.
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const update = (change: (p: Project) => Project) => {
    setStatus('Saving');
    queue.current = queue.current
      .then(async () => { const cur = id && (await getProject(id)); if (cur) await saveProject({ ...change(cur), updatedAt: Date.now() }); })
      .then(() => setStatus('Saved'), () => setStatus('Not saved'));
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      const project = id ? await getProject(id).catch(() => null) : null;
      if (!alive) return;
      if (!project) { setMissing(true); return; }
      const buffers = await getAssets(project.id).catch(() => new Map<string, ArrayBuffer>());
      if (!alive) return;
      setName(project.name);
      setIsPublic(!!project.isPublic);
      document.title = project.name + ' | WONDERfull';
      setLoaded({ project, buffers });
    })();
    return () => { alive = false; };
  }, [id]);

  return (
    <div className="editor-page">
      <div className="topbar">
        <Wordmark href="/" />
        {loaded && (
          <>
            <input className="pname" type="text" id="projectName" aria-label="Scene name" value={name} maxLength={60}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => { const n = name.trim() || 'Untitled scene'; setName(n); update((cur) => ({ ...cur, name: n })); }} />
            <span className="saved" role="status">{status}</span>
            {!cloud && <span className="tag" title="Sign in from All scenes to keep scenes in your account and publish them.">Saved in this browser</span>}
            <span className="grow" />
            {cloud && (
              <button type="button" className={isPublic ? '' : 'primary'} aria-pressed={isPublic}
                onClick={() => { const next = !isPublic; setIsPublic(next); update((cur) => ({ ...cur, isPublic: next })); }}>
                {isPublic ? 'Published. Make private' : 'Publish'}
              </button>
            )}
            <a className="linkbtn" href={'/view?id=' + id} target="_blank" rel="noopener">Open live page</a>
          </>
        )}
        <a className="linkbtn quiet" href="/">All scenes</a>
      </div>
      {missing && <div className="empty">This scene could not be opened. It may belong to another account or another browser. Go back to All scenes.</div>}
      {loaded && (
        <Editor
          key={loaded.project.id}
          data={loaded.project.data}
          buffers={loaded.buffers}
          viewUrl={window.location.origin + '/view?id=' + loaded.project.id}
          onSave={(data, thumb) => update((cur) => ({ ...cur, data, thumb: thumb || cur.thumb }))}
          onAsset={(file, buf) => { putAsset(loaded.project.id, file, buf).catch(() => setStatus('Model not saved')); }}
        />
      )}
    </div>
  );
}

export default function EditPage() {
  return <Suspense fallback={null}><EditScene /></Suspense>;
}
