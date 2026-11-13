'use client';
import { useRef, useState } from 'react';
import { objectDefs, sceneDefs, sectionDefs, timelineDefs } from '../../lib/editor/defs';
import { labelOf, type EditorStore, type Tab } from '../../lib/editor/store';
import { NAMES, TEMPLATES } from '../../lib/scene';
import { Fields } from './Fields';
import { useEditor } from './useEditor';

const names = NAMES as Record<string, string>;
const templates = TEMPLATES as [string, () => any][];
const TABS: [Tab, string][] = [['objects', 'Objects'], ['selected', 'Selected'], ['scene', 'Scene'], ['page', 'Page'], ['timeline', 'Timeline'], ['export', 'Export']];
const ADDABLE = ['box', 'sphere', 'cylinder', 'cone', 'torus', 'capsule', 'knot', 'text3d', 'text', 'particles', 'cord'];

function ObjectsTab({ store }: { store: EditorStore }) {
  return (
    <>
      <h2>Add</h2>
      <div className="chips">
        {ADDABLE.map((t) => <button key={t} type="button" onClick={() => store.addObject(t)}>{names[t]}</button>)}
        <label className="filebtn">
          Import GLB
          <input type="file" id="glbFile" accept=".glb,.gltf,model/gltf-binary" aria-label="Import a GLB model"
            onChange={(e) => { const f = e.target.files && e.target.files[0]; if (f) store.importFile(f); e.target.value = ''; }} />
        </label>
      </div>
      <h2>In this scene</h2>
      <div className="list">
        {store.data.objects.map((o: any) => {
          const missing = o.type === 'model' && !store.hasBuffer(o.file);
          return (
            <div className={'item' + (o.id === store.selected ? ' sel' : '')} key={o.id}>
              <button type="button" className="name" onClick={() => store.select(o.id, true)}>
                {labelOf(o)}<small>{missing ? 'file not loaded, import it again' : names[o.type]}</small>
              </button>
              <button type="button" className="mini" aria-label={'Duplicate ' + labelOf(o)} onClick={() => store.duplicate(o.id)}>Copy</button>
              <button type="button" className="mini" aria-label={'Delete ' + labelOf(o)} onClick={() => store.removeObject(o.id)}>Delete</button>
            </div>
          );
        })}
        {!store.data.objects.length && <p className="note">The scene is empty. Add a shape above.</p>}
      </div>
    </>
  );
}

function SelectedTab({ store }: { store: EditorStore }) {
  const o = store.selectedObject;
  if (!o) return <p className="note">Nothing is selected. Tap an object in the scene, or pick one from the Objects tab.</p>;
  return (
    <>
      <Fields prefix="o" target={o} defs={objectDefs(o, store.data)} onChange={() => store.commit()} />
      <p className="note">States, loops and scroll run in Play mode.</p>
    </>
  );
}

function SceneTab({ store }: { store: EditorStore }) {
  const paste = useRef<HTMLTextAreaElement>(null);
  const [error, setError] = useState('');
  const loadPasted = () => {
    try {
      const next = JSON.parse(paste.current ? paste.current.value : '');
      if (!next || !Array.isArray(next.objects) || !next.camera) throw new Error('not a scene');
      setError('');
      store.loadScene(next, 'Loaded the pasted scene. Undo brings your scene back.');
    } catch (e) {
      setError('That is not scene data. Copy it from the Export tab with "Copy scene data" and paste it here.');
    }
  };
  return (
    <>
      <Fields prefix="s" target={store.data} defs={sceneDefs} onChange={() => store.commit()} />
      <p className="note">The camera on the live page is the view you leave the viewport in while editing.</p>
      <h2>Scenes</h2>
      <div className="chips">
        {templates.map(([label, make]) => (
          <button key={label} type="button" onClick={() => store.loadScene(make(), 'Loaded ' + label + '. Undo brings your scene back.')}>Load {label}</button>
        ))}
      </div>
      <textarea className="code" id="pasteScene" ref={paste} spellCheck={false} style={{ height: 90 }}
        placeholder="Paste scene data copied from the Export tab" aria-label="Scene data to load" />
      <div className="chips"><button type="button" onClick={loadPasted}>Load pasted scene data</button></div>
      <p className="status" role="status">{error}</p>
    </>
  );
}

function PageTab({ store }: { store: EditorStore }) {
  const commit = () => store.commit();
  return (
    <>
      <h2>Page text</h2>
      <p className="note">Sections are real text laid over the scene. Each one shows for a stretch of the scroll. They appear in Play mode and on the live page.</p>
      <Fields prefix="pg" target={store.data} onChange={commit} defs={[
        { k: 'page.color', label: 'Text color', type: 'color' },
        { k: 'page.accent', label: 'Button color', type: 'color' },
      ]} />
      {store.data.sections.map((s: any, i: number) => (
        <div className="group" key={i}>
          <h2>Section {i + 1}</h2>
          <Fields prefix={'sec' + i} target={s} defs={sectionDefs} onChange={commit} />
          <div className="chips"><button type="button" onClick={() => store.removeSection(i)}>Remove section {i + 1}</button></div>
        </div>
      ))}
      <h2>Add</h2>
      <div className="chips"><button type="button" className="primary" onClick={() => store.addSection()}>Add a section</button></div>
    </>
  );
}

function KeyChips({ keys, what, store }: { keys: any[]; what: string; store: EditorStore }) {
  if (!keys.length) return null;
  return (
    <div className="chips">
      {keys.map((k, i) => (
        <span className="kchip" key={k.t}>
          <button type="button" aria-label={'Go to ' + what + ' key at ' + k.t.toFixed(2) + ' seconds'} onClick={() => store.setTime(k.t)}>{k.t.toFixed(2)}s</button>
          <button type="button" aria-label={'Remove ' + what + ' key at ' + k.t.toFixed(2) + ' seconds'} onClick={() => store.removeKey(keys, i)}>✕</button>
        </span>
      ))}
    </div>
  );
}

function Track({ name, keys, store, onName }: { name: string; keys: any[]; store: EditorStore; onName?: () => void }) {
  const dur = store.data.timeline.duration;
  const at = (t: number) => Math.min(100, (t / dur) * 100) + '%';
  return (
    <div className="track">
      {onName ? <button type="button" className="tname" onClick={onName}>{name}</button> : <span className="lab">{name}</span>}
      <div className="bar">
        {keys.map((k) => <span className="dot" key={k.t} style={{ left: at(k.t) }} />)}
        <span className="head" style={{ left: at(store.time) }} />
      </div>
    </div>
  );
}

function TimelineTab({ store }: { store: EditorStore }) {
  const { data } = store;
  const dur = data.timeline.duration;
  const time = Math.min(store.time, dur);
  const stamp = time.toFixed(2) + 's';
  const o = store.selectedObject;
  const keyed = data.objects.filter((x: any) => x.keys.length);
  return (
    <>
      <Fields prefix="t" target={data} defs={timelineDefs} onChange={() => store.commit()} />
      <h2>Playhead</h2>
      <div className="row">
        <label htmlFor="tl-time">Time</label>
        <input type="range" id="tl-time" min={0} max={dur} step={0.01} value={time} onChange={(e) => store.setTime(Number(e.target.value))} />
        <output htmlFor="tl-time">{stamp}</output>
      </div>
      <h2>Tracks</h2>
      {data.camKeys.length > 0 && <Track name="Camera" keys={data.camKeys} store={store} />}
      {keyed.map((x: any) => <Track key={x.id} name={labelOf(x)} keys={x.keys} store={store} onName={() => store.select(x.id)} />)}
      {!data.camKeys.length && !keyed.length && (
        <p className="note">No keys yet. Select an object, move the playhead, pose the object in the viewport, then set a key. Two keys make a move.</p>
      )}
      <h2>{o ? 'Keys for ' + labelOf(o) : 'Object keys'}</h2>
      {o ? (
        <>
          <div className="chips"><button type="button" className="primary" onClick={() => store.setObjectKey()}>Set key at {stamp}</button></div>
          <KeyChips keys={o.keys} what="object" store={store} />
        </>
      ) : (
        <p className="note">Tap an object in the viewport to key it.</p>
      )}
      <h2>Camera keys</h2>
      <div className="chips"><button type="button" className="primary" onClick={() => store.setCameraKey()}>Set key at {stamp}</button></div>
      <KeyChips keys={data.camKeys} what="camera" store={store} />
      <p className="note">A key stores the pose you see at the playhead. Orbit the viewport first to key the camera. Keys play in Play mode.</p>
    </>
  );
}

function ExportTab({ store }: { store: EditorStore }) {
  const code = useRef<HTMLTextAreaElement>(null);
  const [status, setStatus] = useState('');
  const embed = '<iframe src="' + store.viewUrl + '" title="3D scene" loading="lazy" style="width:100%;height:100vh;border:0"></iframe>';
  const copy = (text: string, done: string, select: boolean) => {
    const fail = () => {
      setStatus('Copy was blocked here. The text is selected, so copy it by hand.');
      if (select && code.current) { code.current.focus(); code.current.select(); }
    };
    try { navigator.clipboard.writeText(text).then(() => setStatus(done), fail); } catch (e) { fail(); }
  };
  return (
    <>
      <h2>Live page</h2>
      <div className="chips"><a className="filebtn" href={store.viewUrl} target="_blank" rel="noopener">Open the live page</a></div>
      <p className="note">The live page runs this scene full screen with its text sections, states, scroll and timeline.</p>
      <h2>Embed</h2>
      <textarea className="code" id="codeOut" ref={code} readOnly spellCheck={false} style={{ height: 84 }} aria-label="Embed code" value={embed} />
      <div className="chips">
        <button type="button" className="primary" onClick={() => copy(embed, 'Embed code copied.', true)}>Copy embed code</button>
        <button type="button" onClick={() => copy(JSON.stringify(store.data, null, 2), 'Scene data copied.', false)}>Copy scene data</button>
      </div>
      <p className="status" role="status">{status}</p>
    </>
  );
}

// The side panel: a tab bar and the tab that is open.
export function Panel({ store }: { store: EditorStore }) {
  useEditor(store);
  return (
    <div className="panel">
      <div className="tabs" role="tablist">
        {TABS.map(([tab, label]) => (
          <button key={tab} type="button" role="tab" data-tab={tab} aria-selected={store.tab === tab} onClick={() => store.setTab(tab)}>{label}</button>
        ))}
      </div>
      <div className="pane" id="pane">
        {store.tab === 'objects' && <ObjectsTab store={store} />}
        {store.tab === 'selected' && <SelectedTab store={store} />}
        {store.tab === 'scene' && <SceneTab store={store} />}
        {store.tab === 'page' && <PageTab store={store} />}
        {store.tab === 'timeline' && <TimelineTab store={store} />}
        {store.tab === 'export' && <ExportTab store={store} />}
      </div>
    </div>
  );
}
