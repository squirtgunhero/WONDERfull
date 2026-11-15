'use client';
import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Editor } from '../../components/editor/Editor';
import { Wordmark } from '../../components/Wordmark';
import { addMember, isOwner, listMembers, me as currentUser, removeMember } from '../../lib/cloud';
import { cloudTransport, colorFor, localTransport, type Transport } from '../../lib/editor/transport';
import { getAssets, getProject, isCloudId, putAsset, saveProject, type Project } from '../../lib/store';

type Loaded = { project: Project; buffers: Map<string, ArrayBuffer>; sync: Transport | null; me: { name: string; color: string }; owner: boolean };

// Who a scene is shared with. Only its owner sees this.
function Share({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<string[]>([]);
  const [msg, setMsg] = useState('');
  const load = () => listMembers(projectId).then(setMembers, () => setMsg('The list could not be loaded.'));
  useEffect(() => { if (open) load(); }, [open]);
  const add = async (email: string) => {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) { setMsg('Enter a full email address.'); return; }
    try { await addMember(projectId, email); setMsg(email.trim().toLowerCase() + ' can now open and edit this scene after signing in with that email.'); load(); }
    catch (e: any) { setMsg('That did not work: ' + (e?.message || 'unknown error')); }
  };
  return (
    <div className="share">
      <button type="button" id="shareBtn" aria-expanded={open} onClick={() => setOpen(!open)}>Share</button>
      {open && (
        <div className="sharebox" role="dialog" aria-label="Share this scene">
          <p className="note">People you add can open and edit this scene together with you, and leave comments. They sign in with the email you enter. Only you can publish or delete it.</p>
          <form className="newrow" onSubmit={(e) => { e.preventDefault(); const f = e.currentTarget.elements.namedItem('email') as HTMLInputElement; add(f.value).then(() => { f.value = ''; }); }}>
            <input type="text" inputMode="email" name="email" id="shareEmail" aria-label="Email to share with" placeholder="name@example.com" />
            <button type="submit" className="primary">Add</button>
          </form>
          {members.map((m) => (
            <div className="newrow" key={m}><span className="grow">{m}</span><button type="button" className="quiet" onClick={() => removeMember(projectId, m).then(load, () => setMsg('That did not work.'))}>Remove</button></div>
          ))}
          {!members.length && <p className="note">Not shared with anyone yet.</p>}
          <p className="status" role="status">{msg}</p>
        </div>
      )}
    </div>
  );
}

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
    let alive = true, opened: Transport | null = null;
    (async () => {
      const project = id ? await getProject(id).catch(() => null) : null;
      if (!alive) return;
      if (!project) { setMissing(true); return; }
      const buffers = await getAssets(project.id).catch(() => new Map<string, ArrayBuffer>());
      if (!alive) return;
      setName(project.name);
      setIsPublic(!!project.isPublic);
      document.title = project.name + ' | WONDERfull';
      // Find out who is editing and open the line to anyone else on this scene.
      const who = cloud ? await currentUser().catch(() => null) : null;
      const sync = cloud ? (who ? await cloudTransport(project.id, who.id) : null) : localTransport(project.id);
      const owner = cloud && who ? await isOwner(project.id).catch(() => false) : !cloud;
      if (!alive) { if (sync) sync.close(); return; }
      opened = sync;
      const name = who ? who.email.split('@')[0] : 'Another tab';
      setLoaded({ project, buffers, sync, me: { name, color: colorFor(who ? who.id : String(Math.random())) }, owner });
    })();
    return () => { alive = false; if (opened) opened.close(); };
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
            {cloud && loaded.owner && <Share projectId={loaded.project.id} />}
            {cloud && loaded.owner && (
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
          sync={loaded.sync}
          me={loaded.me}
          projectId={loaded.project.id}
          cloud={cloud}
          owner={loaded.owner}
          onAsset={(file, buf) => { putAsset(loaded.project.id, file, buf).catch(() => setStatus('Model not saved')); }}
        />
      )}
    </div>
  );
}

export default function EditPage() {
  return <Suspense fallback={null}><EditScene /></Suspense>;
}
