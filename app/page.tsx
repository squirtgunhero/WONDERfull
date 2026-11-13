'use client';
import { useEffect, useState } from 'react';
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
const KINDS: [string, () => any][] = [['Blank', blankScene], ...(TEMPLATES as [string, () => any][])];
const when = (t: number) => new Date(t).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [form, setForm] = useState(false);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [armed, setArmed] = useState<string | null>(null);

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
      <div className="dash-head">
        <div>
          <h1>WONDERfull</h1>
          <p>Your 3D scenes and pages. Each one opens in the editor and has its own live page.</p>
        </div>
        <div className="newrow">
          <span>New scene:</span>
          {KINDS.map(([label, make]) => (
            <button key={label} type="button" className={label === 'Blank' ? 'primary' : ''} onClick={() => create(label, make)}>{label}</button>
          ))}
        </div>
      </div>

      <div className="acct">
        {email ? (
          <>
            <span>Signed in as <strong>{email}</strong>. New scenes save to your account.</span>
            <button type="button" onClick={() => signOut().then(refresh)}>Sign out</button>
          </>
        ) : (
          <>
            <span>You are working in this browser only. Sign in to save scenes to your account and publish live pages anyone can open.</span>
            {!form && <button type="button" onClick={() => { setForm(true); setMsg(''); }}>Sign in or create an account</button>}
          </>
        )}
      </div>
      {form && !email && (
        <form className="signin" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); account('in', String(f.get('email') || ''), String(f.get('password') || '')); }}>
          <label htmlFor="acct-email">Email</label>
          <input type="text" inputMode="email" autoComplete="email" id="acct-email" name="email" />
          <label htmlFor="acct-password">Password</label>
          <input type="password" autoComplete="current-password" id="acct-password" name="password" />
          <div className="newrow">
            <button type="submit" className="primary" disabled={busy}>Sign in</button>
            <button type="button" disabled={busy} onClick={(e) => { const f = new FormData(e.currentTarget.form!); account('up', String(f.get('email') || ''), String(f.get('password') || '')); }}>Create account</button>
            <button type="button" onClick={() => setForm(false)}>Cancel</button>
          </div>
        </form>
      )}
      {msg && <p className="status" role="status">{msg}</p>}

      {projects === null ? null : projects.length === 0 ? (
        <div className="empty">No scenes yet. Start one with the buttons above.</div>
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
                  <span className="tag">{p.where === 'cloud' ? (p.isPublic ? 'Account · published' : 'Account · private') : 'This browser'}</span>
                  <time dateTime={new Date(p.updatedAt).toISOString()}>Edited {when(p.updatedAt)}</time>
                </div>
                <div className="acts">
                  <a className="linkbtn primary" href={'/edit?id=' + p.id}>Edit</a>
                  <a className="linkbtn" href={'/view?id=' + p.id} target="_blank" rel="noopener">Live page</a>
                  <button type="button" onClick={() => setRenaming(p.id)}>Rename</button>
                  <button type="button" onClick={() => act(() => duplicateProject(p.id))}>Duplicate</button>
                  {email && p.where === 'local' && (
                    <button type="button" onClick={() => act(() => duplicateProject(p.id, p.name))}>Copy to account</button>
                  )}
                  <button type="button" onClick={() => remove(p.id)}>{armed === p.id ? 'Tap again to delete' : 'Delete'}</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
