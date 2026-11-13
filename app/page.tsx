'use client';
import { useEffect, useState } from 'react';
import { Wordmark } from '../components/Wordmark';
import { describeScene } from '../lib/ai/client';
import { TEMPLATES, starter } from '../lib/scene';
import {
  createProject, currentEmail, deleteProject, duplicateProject, getProject, listProjects, saveProject, signIn, signOut, signUp, type Project,
} from '../lib/store';

function blankScene() {
  const s: any = starter();
  s.objects = [];
  s.scrollCam = { on: false, orbit: 0, zoom: 1, rise: 0 };
  return s;
}
const ABOUT: Record<string, string> = {
  'Starter shapes': 'A handful of objects with hover, click and scroll already set up.',
  'Neon sign': 'A glowing sign on a brick wall with text sections that follow the scroll.',
};
const KINDS: [string, () => any, string][] = [
  ['Blank', blankScene, 'An empty stage with a camera and a light.'],
  ...(TEMPLATES as [string, () => any][]).map(([label, make]) => [label, make, ABOUT[label] || 'A ready-made scene.'] as [string, () => any, string]),
];
const IDEAS = [
  'A lighthouse on a rock at dusk with a slow turning beam',
  'A landing page for a ceramics studio: three vases on a plinth, soft daylight, scroll to walk around them',
  'A neon noodle bar sign on a wet brick wall that flickers on',
];
const when = (t: number) => new Date(t).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [form, setForm] = useState(false);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [armed, setArmed] = useState<string | null>(null);
  const [idea, setIdea] = useState('');
  const [building, setBuilding] = useState(false);
  const [aiMsg, setAiMsg] = useState('');

  const refresh = async () => {
    setEmail(await currentEmail().catch(() => null));
    setProjects(await listProjects().catch(() => []));
  };
  useEffect(() => { refresh(); }, []);

  async function account(kind: 'in' | 'up', e: string, p: string) {
    if (!e || p.length < 6) { setMsg('Enter your email and a password of at least 6 characters.'); return; }
    setBusy(true); setMsg('');
    if (kind === 'in') {
      const err = await signIn(e, p);
      if (err) setMsg(err); else { setForm(false); await refresh(); }
    } else {
      const res = await signUp(e, p);
      if (res.error) setMsg(res.error);
      else if (res.needsConfirm) setMsg('Account created. Open the confirmation email, then come back and sign in.');
      else { setForm(false); await refresh(); }
    }
    setBusy(false);
  }
  async function create(label: string, make: () => any) {
    try {
      const p = await createProject(label === 'Blank' ? 'Untitled scene' : label, make());
      window.location.href = '/edit?id=' + p.id;
    } catch (err: any) { setMsg('The scene could not be created: ' + (err?.message || 'unknown error')); }
  }
  async function build() {
    const prompt = idea.trim();
    if (building) return;
    if (prompt.length < 3) { setAiMsg('Describe the scene in a few words first.'); return; }
    if (!email) { setAiMsg('Sign in to build from a description. Your words stay here while you do.'); setForm(true); return; }
    setBuilding(true); setAiMsg('Building. This usually takes under a minute.');
    try {
      const built = await describeScene(prompt);
      const p = await createProject(built.name, built.scene);
      window.location.href = '/edit?id=' + p.id;
    } catch (err: any) {
      setAiMsg(err?.message || 'That did not work. Try again.');
      setBuilding(false);
    }
  }
  async function act(run: () => Promise<unknown>) {
    try { await run(); } catch (err: any) { setMsg('That did not work: ' + (err?.message || 'unknown error')); }
    refresh();
  }
  async function rename(id: string, name: string) {
    setRenaming(null);
    if (!name.trim()) return;
    act(async () => { const p = await getProject(id); if (p) await saveProject({ ...p, name: name.trim().slice(0, 60) }); });
  }
  function remove(id: string) {
    if (armed !== id) { setArmed(id); return; }
    setArmed(null);
    act(() => deleteProject(id));
  }

  return (
    <div className="wrap">
      <div className="sitebar">
        <Wordmark />
        <div className="who">
          {email ? (
            <>
              <strong>{email}</strong>
              <button type="button" onClick={() => signOut().then(refresh)}>Sign out</button>
            </>
          ) : (
            !form && <button type="button" onClick={() => { setForm(true); setMsg(''); }}>Sign in or create an account</button>
          )}
        </div>
      </div>

      <div className="dash-head">
        <h1>Scenes</h1>
        <p>Build a 3D page, then publish it as a link anyone can open.</p>
      </div>

      {!email && !form && (
        <div className="acct">You are working in this browser only. Sign in to save scenes to your account and publish live pages anyone can open.</div>
      )}
      {form && !email && (
        <form className="signin" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); account('in', String(f.get('email') || ''), String(f.get('password') || '')); }}>
          <label htmlFor="acct-email">Email</label>
          <input type="text" inputMode="email" autoComplete="email" id="acct-email" name="email" />
          <label htmlFor="acct-password">Password</label>
          <input type="password" autoComplete="current-password" id="acct-password" name="password" />
          <div className="newrow">
            <button type="submit" className="primary" disabled={busy}>Sign in</button>
            <button type="button" disabled={busy} onClick={(e) => { const f = new FormData(e.currentTarget.form!); account('up', String(f.get('email') || ''), String(f.get('password') || '')); }}>Create account</button>
            <button type="button" className="quiet" onClick={() => setForm(false)}>Cancel</button>
          </div>
        </form>
      )}
      {msg && <p className="status" role="status" style={{ marginBottom: 18 }}>{msg}</p>}

      <h2 className="sub" id="describe-h">Describe a scene</h2>
      <form className="describe" onSubmit={(e) => { e.preventDefault(); build(); }}>
        <textarea className="say" id="describe" rows={3} maxLength={2000} aria-labelledby="describe-h" value={idea} disabled={building}
          placeholder="Say what you want to see. Objects, mood, colors, text, what moves and what happens on scroll."
          onChange={(e) => setIdea(e.target.value)} />
        <div className="newrow">
          <button type="submit" className="primary" id="describeGo" disabled={building}>{building ? 'Building' : 'Build scene'}</button>
          <span className="status" role="status" id="describeStatus">{aiMsg}</span>
        </div>
        {!idea && (
          <div className="ideas">
            <span>Or start from one of these:</span>
            {IDEAS.map((text) => <button key={text} type="button" className="quiet" onClick={() => { setIdea(text); setAiMsg(''); }}>{text}</button>)}
          </div>
        )}
      </form>

      <h2 className="sub">Or start from a template</h2>
      <div className="starts">
        {KINDS.map(([label, make, about]) => (
          <button key={label} type="button" onClick={() => create(label, make)}><b>{label}</b><span>{about}</span></button>
        ))}
      </div>

      <h2 className="sub">Your scenes</h2>
      {projects === null ? null : projects.length === 0 ? (
        <div className="empty">No scenes yet. Pick a starting point above and it opens in the editor.</div>
      ) : (
        <div className="grid">
          {projects.map((p) => (
            <div className="pcard" key={p.id}>
              <a className="thumb" href={'/edit?id=' + p.id} aria-label={'Open ' + p.name}>
                {p.thumb ? <img src={p.thumb} alt="" /> : <div className="blank">No preview yet</div>}
              </a>
              <div className="meta">
                {renaming === p.id ? (
                  <input type="text" id={'rn-' + p.id} aria-label="Scene name" defaultValue={p.name} autoFocus maxLength={60}
                    onBlur={(e) => rename(p.id, e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setRenaming(null); }} />
                ) : (
                  <div className="pn">{p.name}</div>
                )}
                <div className="tags">
                  {p.where === 'cloud' ? (p.isPublic ? <span className="tag live">Published</span> : <span className="tag">Private</span>) : <span className="tag">This browser</span>}
                  <time dateTime={new Date(p.updatedAt).toISOString()}>Edited {when(p.updatedAt)}</time>
                </div>
                <div className="acts">
                  <a className="linkbtn quiet" href={'/view?id=' + p.id} target="_blank" rel="noopener">Live page</a>
                  <button type="button" className="quiet" onClick={() => setRenaming(p.id)}>Rename</button>
                  <button type="button" className="quiet" onClick={() => act(() => duplicateProject(p.id))}>Duplicate</button>
                  {email && p.where === 'local' && (
                    <button type="button" className="quiet" onClick={() => act(() => duplicateProject(p.id, p.name))}>Copy to account</button>
                  )}
                  <button type="button" className="quiet danger" onClick={() => remove(p.id)}>{armed === p.id ? 'Tap again to delete' : 'Delete'}</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
