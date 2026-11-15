'use client';
import { useEffect, useRef, useState } from 'react';
import { objectDefs, sceneDefs, sectionDefs, timelineDefs } from '../../lib/editor/defs';
import { labelOf, type EditorStore, type Tab } from '../../lib/editor/store';
import { describeScene } from '../../lib/ai/client';
import { addComment, deleteComment, listComments, me as currentUser, resolveComment, type Comment } from '../../lib/cloud';
import { NAMES } from '../../lib/scene';
import { LIBRARY, PARTS } from '../../lib/templates';
import { Fields, fill } from './Fields';
import { useEditor } from './useEditor';

const names = NAMES as Record<string, string>;
const templates = (LIBRARY as { label: string; make: () => any }[]).map((t) => [t.label, t.make] as [string, () => any]);
const parts = PARTS as [string, () => any[]][];
const TABS: [Tab, string][] = [['describe', 'Describe'], ['objects', 'Objects'], ['selected', 'Selected'], ['scene', 'Scene'], ['page', 'Page'], ['timeline', 'Timeline'], ['export', 'Export'], ['comments', 'Comments']];
const ADDABLE = ['clay', 'box', 'sphere', 'cylinder', 'cone', 'torus', 'capsule', 'knot', 'pyramid', 'dome', 'arch', 'star', 'heart', 'shape', 'text3d', 'text', 'particles', 'cord', 'light'];

const STARTERS = ['A glossy bouncing sphere', '20 cubes in a grid that ripple', 'A desk lamp you can switch on'];

// Change the scene by saying what you want. Requests and what came of them are listed in order.
function DescribeTab({ store }: { store: EditorStore }) {
  const box = useRef<HTMLTextAreaElement>(null);
  const { ai } = store;
  const sel = store.selectedObject;
  const empty = !store.data.objects.length;
  const send = () => {
    const prompt = box.current ? box.current.value.trim() : '';
    if (prompt.length < 3 || ai.busy) return;
    store.describe(prompt, (text, scene, selected, earlier) => describeScene(text, scene, selected, earlier)).then(() => { if (!store.ai.status && box.current) box.current.value = ''; });
  };
  return (
    <div className="agent">
      <div className="agent-log">
        <h2 id="describe-h">{empty ? 'Describe the scene' : 'Describe a change'}</h2>
        {ai.log.length === 0 ? (
          <>
            <p className="note">Say what you want and it is built for you. Then keep going: ask for changes one at a time.</p>
            {empty && (
              <div className="chips">
                {STARTERS.map((text) => <button key={text} type="button" onClick={() => { if (box.current) { box.current.value = text; box.current.focus(); } }}>{text}</button>)}
              </div>
            )}
          </>
        ) : (
          <ol className="said">
            {ai.log.slice().reverse().map((entry, i) => <li key={i}><b>{entry.prompt}</b><span>{entry.summary}</span></li>)}
          </ol>
        )}
      </div>
      <div className="agent-box">
        <textarea className="say" id="describeBox" ref={box} rows={3} maxLength={2000} aria-labelledby="describe-h" disabled={ai.busy}
          placeholder={empty ? 'A lighthouse on a rock at dusk with a slow turning beam' : 'Make the background a deep night blue and add slow drifting snow'}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); } }} />
        <div className="chips">
          <button type="button" className="primary" id="describeGo" disabled={ai.busy} onClick={send}>{ai.busy ? 'Building' : empty ? 'Build it' : 'Apply change'}</button>
        </div>
        <p className="status" role="status" id="describeStatus">{ai.status}</p>
        <p className="note" id="describeNote">
          {sel ? 'Selected: ' + labelOf(sel) + '. Say "this" or "it" to mean that object. ' : 'Select an object first to talk about just that one. '}
          Each change is one step, so Undo brings the scene back.
        </p>
      </div>
    </div>
  );
}

function ObjectsTab({ store }: { store: EditorStore }) {
  // Grouped objects are listed together under their group's name, in the order groups first appear.
  const entries: { group: string; parts: any[] }[] = [];
  store.data.objects.forEach((o: any) => {
    const at = o.group ? entries.find((e) => e.group === o.group) : null;
    if (at) at.parts.push(o); else entries.push({ group: o.group || '', parts: [o] });
  });
  const row = (o: any) => {
    const missing = (o.type === 'model' || o.type === 'image' || o.type === 'video') && !store.hasBuffer(o.file);
    return (
      <div className={'item' + (o.id === store.selected ? ' sel' : '')} key={o.id}>
        <button type="button" className="name" onClick={() => store.select(o.id, true)}>
          {labelOf(o)}<small>{missing ? 'file not loaded, import it again' : names[o.type]}</small>
          {store.peersOn(o.id).map((p) => <i key={p.key} className="dotc who" style={{ background: p.color }} title={p.name + ' has this selected'} />)}
        </button>
        <button type="button" className="mini" aria-label={'Duplicate ' + labelOf(o)} onClick={() => store.duplicate(o.id)}>Copy</button>
        <button type="button" className="mini" aria-label={'Delete ' + labelOf(o)} onClick={() => store.removeObject(o.id)}>Delete</button>
      </div>
    );
  };
  return (
    <>
      <h2>Add</h2>
      <div className="chips">
        {ADDABLE.map((t) => <button key={t} type="button" onClick={() => store.addObject(t)}>{names[t]}</button>)}
        <label className="filebtn">
          Import a model, picture or video
          <input type="file" id="glbFile" accept=".glb,.gltf,model/gltf-binary,image/png,image/jpeg,image/webp,image/gif,image/svg+xml,video/mp4,video/webm,video/quicktime" aria-label="Import a GLB model, a picture or a video"
            onChange={(e) => { const f = e.target.files && e.target.files[0]; if (f) store.importFile(f); e.target.value = ''; }} />
        </label>
      </div>
      <h2>Ready-made</h2>
      <div className="chips">
        {parts.map(([label, make]) => <button key={label} type="button" onClick={() => store.addPart(label, make())}>{label}</button>)}
      </div>
      <h2>In this scene</h2>
      <div className="list">
        {entries.map((e) => (e.group ? (
          <div className="grp" key={'g:' + e.group}>
            <div className="item ghead">
              <span className="name">{e.group}<small>{e.parts.length} {e.parts.length === 1 ? 'part' : 'parts'}</small></span>
              <button type="button" className="mini" aria-label={'Duplicate group ' + e.group} onClick={() => store.duplicateGroup(e.group)}>Copy</button>
              <button type="button" className="mini" aria-label={'Delete group ' + e.group} onClick={() => store.removeGroup(e.group)}>Delete</button>
            </div>
            {e.parts.map(row)}
          </div>
        ) : row(e.parts[0])))}
        {!store.data.objects.length && <p className="note">The scene is empty. Add a shape above.</p>}
      </div>
    </>
  );
}

const CUTTABLE = ['clay', 'box', 'sphere', 'cylinder', 'cone', 'torus', 'capsule', 'knot', 'pyramid', 'dome', 'arch', 'star', 'heart', 'shape', 'text3d'];

// A pad for drawing a flat outline: tap empty space to add a corner, drag a corner to move it.
function ShapePad({ o, store }: { o: any; store: EditorStore }) {
  const svg = useRef<SVGSVGElement>(null);
  const [picked, setPicked] = useState(-1);
  const drag = useRef(-1);
  const at = (e: React.PointerEvent) => {
    const r = svg.current!.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 2.6 - 1.3, y = 1.3 - ((e.clientY - r.top) / r.height) * 2.6;
    return [Math.round(Math.max(-1.25, Math.min(1.25, x)) * 100) / 100, Math.round(Math.max(-1.25, Math.min(1.25, y)) * 100) / 100];
  };
  const down = (e: React.PointerEvent) => {
    const p = at(e), pts: number[][] = o.pts;
    let hit = pts.findIndex((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 0.16);
    if (hit < 0 && pts.length < 32) {
      // The new corner goes into the edge it is closest to.
      let best = 0, bestD = Infinity;
      pts.forEach((a, i) => {
        const b = pts[(i + 1) % pts.length], dx = b[0] - a[0], dy = b[1] - a[1];
        const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
        const d = Math.hypot(p[0] - (a[0] + dx * t), p[1] - (a[1] + dy * t));
        if (d < bestD) { bestD = d; best = i + 1; }
      });
      pts.splice(best, 0, p);
      hit = best;
      store.commit();
    }
    drag.current = hit; setPicked(hit);
    svg.current!.setPointerCapture(e.pointerId);
  };
  const move = (e: React.PointerEvent) => { if (drag.current >= 0 && o.pts[drag.current]) { o.pts[drag.current] = at(e); store.commit(); } };
  const path = o.pts.map((p: number[], i: number) => (i ? 'L' : 'M') + p[0] + ' ' + -p[1]).join(' ') + ' Z';
  return (
    <div className="lib">
      <h2>Outline</h2>
      <svg ref={svg} id="shapePad" className="pad" viewBox="-1.3 -1.3 2.6 2.6" role="img" aria-label="Outline of the shape. Tap to add a corner, drag a corner to move it."
        onPointerDown={down} onPointerMove={move} onPointerUp={() => { drag.current = -1; }}>
        <path d="M-1.3 0H1.3M0 -1.3V1.3" className="axis" />
        <path d={path} className="fillp" />
        {o.pts.map((p: number[], i: number) => <circle key={i} cx={p[0]} cy={-p[1]} r={0.07} className={i === picked ? 'pt on' : 'pt'} />)}
      </svg>
      <div className="chips">
        <button type="button" id="removePoint" disabled={picked < 0 || o.pts.length <= 3} onClick={() => { o.pts.splice(picked, 1); setPicked(-1); store.commit(); }}>Remove the picked corner</button>
      </div>
      <p className="note">Tap empty space to add a corner. Drag a corner to move it. Depth and curved corners are below.</p>
    </div>
  );
}

function SelectedTab({ store }: { store: EditorStore }) {
  const o = store.selectedObject;
  if (!o) return <p className="note">Nothing is selected. Tap an object in the scene, or pick one from the Objects tab.</p>;
  return (
    <>
      {o.group && (
        <label className="grpcheck" htmlFor="wholeGroup">
          <input type="checkbox" id="wholeGroup" checked={store.wholeGroup} onChange={(e) => store.setWholeGroup(e.target.checked)} />
          The handles move all of {o.group} ({store.groupOf(o).length} parts)
        </label>
      )}
      {o.type === 'shape' && <ShapePad o={o} store={store} />}
      {o.type === 'clay' && (
        <div className="lib">
          <h2>Sculpt</h2>
          <label className="grpcheck" htmlFor="sculptOn">
            <input type="checkbox" id="sculptOn" checked={store.sculpt.on} onChange={(e) => store.setSculpt({ on: e.target.checked })} />
            Sculpt in the viewport. Dragging across the clay reshapes it.
          </label>
          <div className="chips" role="group" aria-label="Brush">
            {([['pull', 'Pull out'], ['push', 'Push in'], ['smooth', 'Smooth']] as const).map(([mode, label]) => (
              <button key={mode} type="button" data-brush={mode} aria-pressed={store.sculpt.mode === mode} onClick={() => store.setSculpt({ mode, on: true })}>{label}</button>
            ))}
          </div>
          <div className="row"><label htmlFor="brushSize">Brush size</label>
            <input type="range" id="brushSize" min={0.08} max={1.2} step={0.01} value={store.sculpt.size} style={fill(store.sculpt.size, 0.08, 1.2)} onChange={(e) => store.setSculpt({ size: Number(e.target.value) })} /></div>
          <div className="row"><label htmlFor="brushStrength">Strength</label>
            <input type="range" id="brushStrength" min={0.005} max={0.12} step={0.005} value={store.sculpt.strength} style={fill(store.sculpt.strength, 0.005, 0.12)} onChange={(e) => store.setSculpt({ strength: Number(e.target.value) })} /></div>
          <div className="chips"><button type="button" id="resetClay" onClick={() => store.resetClay()}>Start again from a plain ball</button></div>
          <p className="note">Clay starts as a ball. Stretch it with Size for other starting forms. Each stroke is one step for Undo.</p>
        </div>
      )}
      {CUTTABLE.includes(o.type) && !o.cutter && (
        <div className="lib">
          <h2>Cut away</h2>
          <div className="chips">
            {o.cuts.map((id: string) => { const c = store.byId(id); return c ? (
              <span className="kchip" key={id}>
                <button type="button" onClick={() => store.select(id)}>{labelOf(c)}</button>
                <button type="button" aria-label={'Stop cutting with ' + labelOf(c)} onClick={() => store.removeCut(id)}>✕</button>
              </span>
            ) : null; })}
          </div>
          <div className="row">
            <label htmlFor="addCut">Carve out</label>
            <select id="addCut" value="" onChange={(e) => { if (e.target.value) store.addCut(e.target.value); }}>
              <option value="">Pick an object to cut out of this one</option>
              {store.data.objects.filter((x: any) => x.id !== o.id && CUTTABLE.includes(x.type) && !o.cuts.includes(x.id) && !x.cuts.length).map((x: any) => <option key={x.id} value={x.id}>{labelOf(x)}</option>)}
            </select>
          </div>
        </div>
      )}
      {o.cutter && <p className="note">This object is a cutting tool. It shows as a wire frame while editing and is hidden in Play. Move it to change the cut.</p>}
      {o.type !== 'model' && o.type !== 'light' && (
        <div className="lib">
          <h2>Saved materials</h2>
          <div className="chips">
            {store.data.swatches.map((sw: any) => (
              <span className="kchip" key={sw.id}>
                <button type="button" aria-label={'Use the material ' + sw.name} onClick={() => store.applyMaterial(sw.id)}><i className="dotc" style={{ background: sw.mat.color }} />{sw.name}</button>
                <button type="button" aria-label={'Remove the material ' + sw.name} onClick={() => store.removeMaterial(sw.id)}>✕</button>
              </span>
            ))}
            <button type="button" id="saveMaterial" onClick={() => store.saveMaterial()}>Save this material</button>
          </div>
          <h2>Scene colors</h2>
          <div className="chips">
            {store.data.palette.map((hex: string) => (
              <span className="kchip" key={hex}>
                <button type="button" aria-label={'Use the color ' + hex} onClick={() => store.applyColor(hex)}><i className="dotc" style={{ background: hex }} />{hex}</button>
                <button type="button" aria-label={'Remove the color ' + hex} onClick={() => store.removeColor(hex)}>✕</button>
              </span>
            ))}
            <button type="button" id="addColor" onClick={() => store.addColor()}>Keep this color</button>
          </div>
        </div>
      )}
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
      <p className="note">The camera on the live page is the view you leave the viewport in while editing, unless a saved camera is set to start.</p>
      <h2>Cameras</h2>
      <div className="list">
        {store.data.cameras.map((c: any) => (
          <div className="item cam" key={c.id}>
            <input type="text" aria-label="Camera name" value={c.name} maxLength={30} onChange={(e) => { c.name = e.target.value; store.commit(); }} />
            <button type="button" className="mini" aria-label={'Look through ' + c.name} onClick={() => store.goCamera(c.id)}>Go</button>
            <button type="button" className="mini" aria-label={'Store the current view in ' + c.name} onClick={() => store.updateCamera(c.id)}>Update</button>
            <button type="button" className="mini" aria-label={'Delete ' + c.name} onClick={() => store.removeCamera(c.id)}>Delete</button>
          </div>
        ))}
      </div>
      <div className="chips"><button type="button" id="addCamera" onClick={() => store.addCamera()}>Save this view as a camera</button></div>
      {store.data.cameras.length > 0 && (
        <div className="row">
          <label htmlFor="playCam">Starts on</label>
          <select id="playCam" value={store.data.playCam} onChange={(e) => { store.data.playCam = e.target.value; store.commit(); }}>
            <option value="">The editing view</option>
            {store.data.cameras.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      )}
      <p className="note">A clickable object can move the view to a saved camera. Set that under Click in the Selected tab.</p>
      <div className="row">
        <label htmlFor="followCam">Camera follows</label>
        <select id="followCam" value={store.data.followCam} onChange={(e) => { store.data.followCam = e.target.value; store.commit(); }}>
          <option value="">Nothing</option>
          {store.data.objects.map((x: any) => <option key={x.id} value={x.id}>{labelOf(x)}</option>)}
        </select>
      </div>
      <h2>Variables</h2>
      <p className="note">A variable is a named value the scene keeps while it plays. Write its name in curly braces in any text to show it. Clicks can change it, and objects can appear when it is on.</p>
      {store.data.vars.map((v: any) => (
        <div className="group var" key={v.id}>
          <div className="row"><label htmlFor={'vn-' + v.id}>Name</label><input type="text" id={'vn-' + v.id} defaultValue={v.name} maxLength={20} onBlur={(e) => { store.renameVar(v, e.target.value); e.target.value = v.name; }} /></div>
          <div className="row"><label htmlFor={'vk-' + v.id}>Holds</label>
            <select id={'vk-' + v.id} value={v.kind} onChange={(e) => { v.kind = e.target.value; v.value = v.kind === 'number' ? 0 : v.kind === 'toggle' ? false : ''; store.commit(); }}>
              <option value="number">A number</option><option value="text">Text</option><option value="toggle">On or off</option>
            </select></div>
          <div className="row"><label htmlFor={'vv-' + v.id}>Starts as</label>
            {v.kind === 'toggle'
              ? <select id={'vv-' + v.id} value={v.value ? 'on' : 'off'} onChange={(e) => { v.value = e.target.value === 'on'; store.commit(); }}><option value="off">Off</option><option value="on">On</option></select>
              : <input type="text" id={'vv-' + v.id} value={String(v.value)} maxLength={80} inputMode={v.kind === 'number' ? 'decimal' : 'text'} onChange={(e) => { v.value = v.kind === 'number' ? (e.target.value === '' || e.target.value === '-' ? e.target.value : Number(e.target.value) || 0) : e.target.value; store.commit(); }} />}
          </div>
          <div className="row"><label htmlFor={'vu-' + v.id}>Live from</label><input type="text" id={'vu-' + v.id} placeholder="https:// address that returns JSON (optional)" value={v.src.url} onChange={(e) => { v.src.url = e.target.value.trim(); store.commit(); }} /></div>
          {v.src.url && (
            <>
              <div className="row"><label htmlFor={'vp-' + v.id}>Field</label><input type="text" id={'vp-' + v.id} placeholder="such as data.price" value={v.src.path} onChange={(e) => { v.src.path = e.target.value.trim(); store.commit(); }} /></div>
              <p className="note">Read on the live page and in Play, and refreshed every 30 seconds. The address must allow requests from other sites.</p>
            </>
          )}
          <div className="chips"><button type="button" onClick={() => store.removeVar(v.id)}>Remove {v.name}</button></div>
        </div>
      ))}
      <div className="chips"><button type="button" id="addVar" onClick={() => store.addVar()}>Add a variable</button></div>
      <h2>Replace with a template</h2>
      <div className="chips">
        {templates.map(([label, make]) => (
          <button key={label} type="button" onClick={() => store.loadScene(make(), 'Loaded ' + label + '. Undo brings your scene back.')}>{label}</button>
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
        <input type="range" id="tl-time" min={0} max={dur} step={0.01} value={time} style={fill(time, 0, dur)} onChange={(e) => store.setTime(Number(e.target.value))} />
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
  const [kind, setKind] = useState<'html' | 'react'>('html');
  const origin = store.viewUrl.split('/view')[0];
  const json = JSON.stringify(store.data).replace(/</g, '\\u003c');
  const snippet = kind === 'html'
    ? '<div id="wonderfull-scene" style="width:100%;height:100vh"></div>\n<script src="' + origin + '/wonderfull-runtime.js"></script>\n<script>\n  WONDERfull.mount("#wonderfull-scene", ' + json + ');\n</script>'
    : "import { useEffect, useRef } from 'react';\n\nconst scene = " + json + ";\n\nexport default function Scene() {\n  const ref = useRef(null);\n  useEffect(() => {\n    let mounted;\n    const s = document.createElement('script');\n    s.src = '" + origin + "/wonderfull-runtime.js';\n    s.onload = () => { if (ref.current) mounted = window.WONDERfull.mount(ref.current, scene); };\n    document.head.appendChild(s);\n    return () => { if (mounted) mounted.unmount(); s.remove(); };\n  }, []);\n  return <div ref={ref} style={{ width: '100%', height: '100vh' }} />;\n}";
  const download = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(store.data, null, 2)], { type: 'application/json' }));
    a.download = 'scene.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    setStatus('Scene file downloaded.');
  };
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
      <h2>Code</h2>
      <p className="note">Runs the scene on your own page, with no frame around it. The scene travels inside the code, so it works without publishing. Imported models and pictures are not included.</p>
      <div className="chips" role="group" aria-label="Code format">
        <button type="button" aria-pressed={kind === 'html'} onClick={() => setKind('html')}>HTML</button>
        <button type="button" aria-pressed={kind === 'react'} onClick={() => setKind('react')}>React</button>
      </div>
      <textarea className="code" id="codeExport" readOnly spellCheck={false} style={{ height: 150 }} aria-label="Code for your own page" value={snippet} />
      <div className="chips">
        <button type="button" className="primary" id="copyCode" onClick={() => copy(snippet, 'Code copied.', false)}>Copy code</button>
        <button type="button" id="downloadScene" onClick={download}>Download scene file</button>
      </div>
    </>
  );
}

// Notes people leave on a scene, optionally about one object. Kept with the scene in the account.
function CommentsTab({ store }: { store: EditorStore }) {
  const { projectId, cloud } = store.opts;
  const [list, setList] = useState<Comment[] | null>(null);
  const [mine, setMine] = useState('');
  const [msg, setMsg] = useState('');
  const [about, setAbout] = useState(true);
  const box = useRef<HTMLTextAreaElement>(null);
  const sel = store.selectedObject;
  const load = () => { if (cloud && projectId) listComments(projectId).then(setList, () => { setList([]); setMsg('Comments could not be loaded. Sign in to see them.'); }); };
  useEffect(() => { load(); currentUser().then((u) => setMine(u ? u.id : ''), () => {}); }, [projectId, store.commentsStamp]);
  if (!cloud || !projectId) return <p className="note">Comments are kept with scenes saved to an account. This scene lives in this browser. Sign in from All scenes, then use Copy to account.</p>;
  const changed = () => { load(); store.tellComments(); };
  const send = async () => {
    const body = box.current ? box.current.value.trim() : '';
    if (!body) return;
    try { await addComment(projectId, body, about && sel ? sel.id : null); if (box.current) box.current.value = ''; setMsg(''); changed(); }
    catch (e: any) { setMsg('The comment was not saved: ' + (e?.message || 'unknown error')); }
  };
  const act = (run: Promise<void>) => run.then(changed, () => setMsg('That did not work.'));
  const open = (list || []).filter((c) => !c.resolved), done = (list || []).filter((c) => c.resolved);
  const row = (c: Comment) => {
    const o = c.objectId ? store.byId(c.objectId) : null;
    return (
      <li key={c.id} className={c.resolved ? 'done' : ''}>
        <b>{c.authorEmail.split('@')[0]}{o ? <> on <button type="button" className="quiet inline" onClick={() => store.select(o.id)}>{labelOf(o)}</button></> : null}</b>
        <span>{c.body}</span>
        <div className="acts">
          <button type="button" className="quiet" onClick={() => act(resolveComment(c.id, !c.resolved))}>{c.resolved ? 'Reopen' : 'Resolve'}</button>
          {(c.author === mine || store.opts.owner) && <button type="button" className="quiet" onClick={() => act(deleteComment(c.id))}>Delete</button>}
        </div>
      </li>
    );
  };
  return (
    <>
      <h2 id="comment-h">Add a comment</h2>
      <textarea className="say" id="commentBox" ref={box} rows={3} maxLength={1000} aria-labelledby="comment-h" placeholder="What should change, or what do you like?" />
      {sel && (
        <label className="grpcheck" htmlFor="commentAbout">
          <input type="checkbox" id="commentAbout" checked={about} onChange={(e) => setAbout(e.target.checked)} />About {labelOf(sel)}
        </label>
      )}
      <div className="chips"><button type="button" className="primary" id="commentGo" onClick={send}>Comment</button></div>
      <p className="status" role="status">{msg}</p>
      <h2>Open</h2>
      {list === null ? <p className="note">Loading.</p> : open.length ? <ol className="said notes">{open.map(row)}</ol> : <p className="note">No open comments.</p>}
      {done.length > 0 && <><h2>Resolved</h2><ol className="said notes">{done.map(row)}</ol></>}
    </>
  );
}

const LEFT: Tab[] = ['describe', 'objects'];

// A side panel: a tab bar and the tab that is open. "all" holds every tab (narrow screens);
// on wide screens "left" holds Describe and Objects and "right" holds the rest.
export function Panel({ store, side = 'all' }: { store: EditorStore; side?: 'all' | 'left' | 'right' }) {
  useEditor(store);
  const tabs = TABS.filter(([tab]) => side === 'all' || (side === 'left') === LEFT.includes(tab));
  const open = side === 'left' ? store.leftTab : side === 'right' ? store.rightTab : store.tab;
  return (
    <div className={'panel ' + side}>
      <div className="tabs" role="tablist">
        {tabs.map(([tab, label]) => (
          <button key={tab} type="button" role="tab" data-tab={tab} aria-selected={open === tab} onClick={() => store.setTab(tab)}>{label}</button>
        ))}
      </div>
      <div className={'pane' + (open === 'describe' ? ' talk' : '')} id={side === 'left' ? 'paneLeft' : 'pane'}>
        {open === 'describe' && <DescribeTab store={store} />}
        {open === 'objects' && <ObjectsTab store={store} />}
        {open === 'selected' && <SelectedTab store={store} />}
        {open === 'scene' && <SceneTab store={store} />}
        {open === 'page' && <PageTab store={store} />}
        {open === 'timeline' && <TimelineTab store={store} />}
        {open === 'export' && <ExportTab store={store} />}
        {open === 'comments' && <CommentsTab store={store} />}
      </div>
    </div>
  );
}
