// The editor's state and every action a panel or the viewport can take.
// The scene (this.data) is a plain object that the 3D runtime reads every frame, so actions change
// it in place and then call commit(), which keeps the 3D objects, the save and the panels in step.
import * as THREE from 'three';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { createSceneRuntime } from '../runtime';
import { NAMES, clone, mk, normalize, objectSig, putKey, starter, uid } from '../scene';
import { createHistory } from './history';

export type Mode = 'edit' | 'play';
export type Tab = 'describe' | 'objects' | 'selected' | 'scene' | 'page' | 'timeline' | 'export';
export type Gizmo = 'translate' | 'rotate' | 'scale';
export type EditorOptions = {
  data: any;
  buffers: Map<string, ArrayBuffer>;
  viewUrl: string;
  onSave: (data: any, thumb: string) => void;
  onAsset: (fileName: string, buf: ArrayBuffer) => void;
};

const names = NAMES as Record<string, string>;
const r3 = (v: number) => +v.toFixed(3);
export const labelOf = (o: any): string => o.name || names[o.type] || 'Object';

export class EditorStore {
  data: any;
  buffers: Map<string, ArrayBuffer>;
  viewUrl: string;
  selected: string | null = null;
  mode: Mode = 'edit';
  tab: Tab = 'objects';
  gizmo: Gizmo = 'translate';
  time = 0;      // timeline playhead, in seconds
  scroll = 0;    // scroll preview in Play mode, 0 to 1
  webglFailed = false;
  wholeGroup = true; // when the selected object belongs to a group, the handles move every part of it
  // Building from a description: whether a request is running, what to tell the person, and what was asked so far.
  ai = { busy: false, status: '', log: [] as { prompt: string; summary: string }[] };

  private opts: EditorOptions;
  private rt: any = null;
  private tc: any = null;
  private message = '';
  private version = 0;
  private listeners = new Set<() => void>();
  private history: ReturnType<typeof createHistory>;
  // What each object looked like structurally when its 3D shape was last built.
  private sigs = new Map<string, string>();
  private saveTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(opts: EditorOptions) {
    this.opts = opts;
    this.data = opts.data && Array.isArray(opts.data.objects) && opts.data.camera ? opts.data : starter();
    normalize(this.data);
    this.buffers = opts.buffers;
    this.viewUrl = opts.viewUrl;
    this.history = createHistory(JSON.stringify(this.data));
    this.track();
  }

  // ----- subscription (used by the useEditor hook) -----
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  getVersion = () => this.version;
  private emit() { this.version++; this.listeners.forEach((fn) => fn()); }

  // ----- reading -----
  byId(id: string | null) { return id ? this.data.objects.find((o: any) => o.id === id) || null : null; }
  get selectedObject() { return this.byId(this.selected); }
  get canUndo() { return this.history.canUndo(); }
  get canRedo() { return this.history.canRedo(); }
  get hint() {
    if (this.message) return this.message;
    if (this.mode === 'play') return 'Play mode. Hover, tap, and drag the Scroll slider.';
    const sel = this.selectedObject;
    if (sel && sel.group && this.wholeGroup) return 'The handles move all of ' + sel.group + '. Drag empty space to orbit.';
    return this.selected ? 'Drag the handles to move it. Drag empty space to orbit.' : 'Tap an object to select it. Drag empty space to orbit.';
  }
  hasBuffer(file: string) { return this.buffers.has(file); }
  // Every object that shares this one's group name, or just the object when it has none.
  groupOf(o: any): any[] { return o && o.group ? this.data.objects.filter((x: any) => x.group === o.group) : o ? [o] : []; }

  // ----- viewport lifecycle -----
  // Starts the 3D runtime on the canvas. Returns the function that shuts it down.
  mount(canvas: HTMLCanvasElement, overlay: HTMLElement) {
    try {
      this.rt = createSceneRuntime(canvas, this.data, {
        edit: true, buffers: this.buffers, noFetch: true, overlay,
        onChange: () => this.commit(),
        progress: () => this.scroll,
        onPick: (id: string | null) => { if (this.tc && this.tc.axis) return; this.select(id, !!id); },
        onLink: (url: string) => this.say('On the live page this opens ' + url),
      });
      this.tc = new TransformControls(this.rt.camera, canvas);
      // Bigger handles where the pointer is a finger.
      this.tc.setSize(window.matchMedia && window.matchMedia('(pointer: coarse)').matches ? 1.9 : 1.1);
      // Where the dragged object and the rest of its group stood when the drag began.
      let startInv: THREE.Matrix4 | null = null, mates: { o: any; m: THREE.Matrix4 }[] = [];
      const rad = THREE.MathUtils.degToRad, deg = THREE.MathUtils.radToDeg;
      const matrixOf = (o: any) => new THREE.Matrix4().compose(
        new THREE.Vector3().fromArray(o.pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(rad(o.rot[0]), rad(o.rot[1]), rad(o.rot[2]))), new THREE.Vector3().fromArray(o.scale));
      this.tc.addEventListener('dragging-changed', (e: any) => {
        this.rt.lock = e.value;
        const o = this.selectedObject;
        if (e.value && o) { startInv = matrixOf(o).invert(); mates = this.wholeGroup ? this.groupOf(o).filter((x: any) => x !== o).map((x: any) => ({ o: x, m: matrixOf(x) })) : []; }
        if (!e.value) { startInv = null; mates = []; this.commit(); }
      });
      this.tc.addEventListener('objectChange', () => {
        const o = this.selectedObject, root = this.rt.get(this.selected);
        if (!o || !root) return;
        o.pos = root.position.toArray().map(r3);
        o.rot = [root.rotation.x, root.rotation.y, root.rotation.z].map((v: number) => +deg(v).toFixed(1));
        o.scale = root.scale.toArray().map((v: number) => +Math.max(0.05, Math.abs(v)).toFixed(3));
        if (!startInv || !mates.length) return;
        // The same move, turn or resize, applied to every other part around the dragged one.
        root.updateMatrix();
        const delta = root.matrix.clone().multiply(startInv), p = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), eu = new THREE.Euler();
        mates.forEach(({ o: x, m }) => {
          delta.clone().multiply(m).decompose(p, q, sc);
          eu.setFromQuaternion(q);
          x.pos = p.toArray().map(r3);
          x.rot = [eu.x, eu.y, eu.z].map((v) => +deg(v).toFixed(1));
          x.scale = sc.toArray().map((v) => +Math.max(0.05, Math.abs(v)).toFixed(3));
        });
      });
      this.rt.scene.add(this.tc.getHelper());
      this.attach();
      // Give a scene that has never been edited a preview picture for the scene list.
      const rt = this.rt;
      setTimeout(() => { if (this.rt === rt && !this.saveTimer) this.opts.onSave(this.data, this.thumb()); }, 1500);
    } catch (e) {
      this.webglFailed = true;
    }
    this.emit();
    return () => this.unmount();
  }
  private unmount() {
    if (this.saveTimer) { clearTimeout(this.saveTimer); this.saveTimer = undefined; this.opts.onSave(this.data, this.thumb()); }
    if (this.tc) { this.tc.detach(); this.tc.dispose(); }
    if (this.rt) this.rt.dispose();
    this.rt = null; this.tc = null;
  }
  private attach() {
    if (!this.tc) return;
    const root = this.mode === 'edit' && this.selected ? this.rt.get(this.selected) : null;
    if (root) this.tc.attach(root); else this.tc.detach();
  }
  // A small picture of the scene for the project list.
  thumb(): string {
    if (!this.rt) return '';
    if (this.tc) this.tc.detach();
    const shot = this.rt.snapshot();
    this.attach();
    return shot;
  }

  // ----- the one path every change takes -----
  // Call after changing this.data.
  commit(message = '') {
    this.syncRuntime();
    this.message = message;
    this.scheduleSave();
    this.emit();
  }
  private track() { this.sigs.clear(); this.data.objects.forEach((o: any) => this.sigs.set(o.id, objectSig(o))); }
  // Adds, removes and rebuilds 3D objects so the viewport matches the data.
  private syncRuntime() {
    if (this.rt) {
      const ids = new Set(this.data.objects.map((o: any) => o.id));
      Array.from(this.sigs.keys()).forEach((id) => { if (!ids.has(id)) this.rt.remove(id); });
      this.data.objects.forEach((o: any) => {
        if (!this.sigs.has(o.id)) this.rt.add(o);
        else if (this.sigs.get(o.id) !== objectSig(o)) this.rt.rebuild(o);
      });
    }
    this.track();
    if (!this.byId(this.selected)) this.selected = null;
    this.attach();
  }
  private scheduleSave() {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      this.saveTimer = undefined;
      if (this.history.commit(JSON.stringify(this.data))) this.emit();
      this.opts.onSave(this.data, this.thumb());
    }, 300);
  }
  private replaceScene(next: any) {
    Object.keys(this.data).forEach((k) => delete this.data[k]);
    Object.assign(this.data, next);
    normalize(this.data);
    this.syncRuntime();
    if (this.rt) this.rt.setView(this.data.camera);
  }
  say(message: string) { this.message = message; this.emit(); }

  // ----- history -----
  undo() {
    if (this.mode !== 'edit') return;
    this.history.commit(JSON.stringify(this.data));
    const snap = this.history.undo();
    if (snap) this.restore(snap, 'Undone.');
  }
  redo() {
    if (this.mode !== 'edit') return;
    const snap = this.history.redo();
    if (snap) this.restore(snap, 'Redone.');
  }
  private restore(snap: string, message: string) {
    if (this.saveTimer) { clearTimeout(this.saveTimer); this.saveTimer = undefined; }
    this.replaceScene(JSON.parse(snap));
    this.message = message;
    this.opts.onSave(this.data, this.thumb());
    this.emit();
  }

  // ----- view state -----
  select(id: string | null, openTab = false) {
    this.selected = id;
    if (openTab) this.tab = 'selected';
    this.message = '';
    this.attach();
    this.emit();
  }
  setMode(mode: Mode) {
    this.mode = mode;
    if (this.rt) this.rt.setPlay(mode === 'play');
    this.message = '';
    this.attach();
    this.emit();
  }
  setTab(tab: Tab) { this.tab = tab; this.emit(); }
  setGizmo(gizmo: Gizmo) { this.gizmo = gizmo; if (this.tc) this.tc.setMode(gizmo); this.emit(); }
  setScroll(v: number) { this.scroll = v; this.emit(); }

  // ----- objects -----
  addObject(type: string, over: any = {}) {
    const n = this.data.objects.length;
    const o: any = mk(type, { pos: [((n % 3) - 1) * 0.5, type === 'text' ? 1.4 : type === 'model' ? 0 : 0.6, 0.6 + (n % 2) * 0.4], ...over });
    if (type === 'text' || type === 'text3d') { o.text = 'Your words'; o.mat.color = '#143b29'; }
    if (type === 'text3d') { o.depth = 0.25; o.bevel = 0.03; }
    if (type === 'cord') { o.pos = [0, 2, 0.6]; o.to = [1, -1.5, 0]; o.slack = 0.4; o.thick = 0.02; o.mat.color = '#161616'; }
    if (type === 'light') { o.pos = [0, 2, 0.6]; o.power = 8; o.reach = 8; o.mat.color = '#ffd9a0'; }
    if (type === 'particles') { o.pos = [0, 1.3, 0]; o.count = 200; o.spread = 3; o.speed = 0.4; o.psize = 0.11; o.mat.color = '#ff4f2e'; }
    this.data.objects.push(o);
    this.selected = o.id;
    this.tab = 'selected';
    this.commit();
  }
  removeObject(id: string) {
    this.data.objects = this.data.objects.filter((o: any) => o.id !== id);
    this.commit();
  }
  duplicate(id: string) {
    const src = this.byId(id);
    if (!src) return;
    const o = clone(src);
    o.id = uid(); o.name = labelOf(src) + ' copy'; o.pos = [o.pos[0] + 0.5, o.pos[1], o.pos[2] + 0.5];
    this.data.objects.push(o);
    this.selected = o.id;
    this.commit();
  }
  setWholeGroup(on: boolean) { this.wholeGroup = on; this.emit(); }
  removeGroup(name: string) {
    this.data.objects = this.data.objects.filter((o: any) => o.group !== name);
    this.commit();
  }
  // Copies every part of a group, keeping the clicks between its parts pointing at the copies.
  duplicateGroup(name: string) {
    const parts = this.data.objects.filter((o: any) => o.group === name);
    if (!parts.length) return;
    const taken = new Set(this.data.objects.map((o: any) => o.group));
    let label = (name + ' copy').slice(0, 30);
    for (let n = 2; taken.has(label); n++) label = (name.slice(0, 22) + ' copy ' + n);
    const ids = new Map<string, string>(parts.map((o: any) => [o.id, uid()]));
    parts.forEach((src: any) => {
      const o = clone(src);
      o.id = ids.get(src.id); o.group = label; o.pos = [r3(o.pos[0] + 0.8), o.pos[1], r3(o.pos[2] + 0.8)];
      if (o.click && ids.has(o.click.target)) o.click.target = ids.get(o.click.target);
      (o.keys || []).forEach((k: any) => { k.pos = [r3(k.pos[0] + 0.8), k.pos[1], r3(k.pos[2] + 0.8)]; });
      this.data.objects.push(o);
    });
    this.selected = ids.get(parts[0].id) || null;
    this.commit('Copied ' + name + '.');
  }
  async importFile(file: File) {
    // Storage keys allow a limited set of characters, so the stored name is a cleaned copy.
    const name = file.name.replace(/[^A-Za-z0-9._-]/g, '_');
    let buf: ArrayBuffer;
    try { buf = await file.arrayBuffer(); } catch (e) { this.say('That file could not be read.'); return; }
    this.buffers.set(name, buf);
    this.opts.onAsset(name, buf);
    const waiting = this.data.objects.filter((o: any) => o.type === 'model' && o.file === name);
    if (waiting.length) {
      waiting.forEach((o: any) => this.rt && this.rt.rebuild(o));
      this.attach();
      this.say('Reloaded ' + name);
    } else {
      this.addObject('model', { name: name.replace(/\.[^.]+$/, ''), file: name });
    }
  }
  loadScene(next: any, message: string) {
    this.replaceScene(next);
    this.selected = null;
    this.time = 0;
    this.attach();
    this.commit(message);
  }
  // Changes the scene from a plain-language request. "run" does the asking, so this file stays free of network code.
  // The result lands as one step that Undo reverses.
  async describe(prompt: string, run: (prompt: string, scene: any, selected: string | null, earlier: string[]) => Promise<{ scene: any; summary: string }>) {
    if (this.ai.busy) return;
    this.ai.busy = true;
    this.ai.status = 'Building. This usually takes under a minute.';
    this.emit();
    try {
      this.history.commit(JSON.stringify(this.data));
      const res = await run(prompt, clone(this.data), this.selected, this.ai.log.slice(0, 6).map((x) => x.prompt).reverse());
      const keep = this.selected;
      if (this.mode !== 'edit') this.setMode('edit');
      this.replaceScene(res.scene);
      this.selected = this.byId(keep) ? keep : null;
      this.time = 0;
      this.ai.log.unshift({ prompt, summary: res.summary });
      this.ai.log.length = Math.min(this.ai.log.length, 12);
      this.ai.busy = false;
      this.ai.status = '';
      this.commit(res.summary + ' Undo brings the scene back.');
    } catch (e: any) {
      this.ai.busy = false;
      this.ai.status = (e && e.message) || 'That did not work. Try again.';
      this.emit();
    }
  }

  // ----- page sections -----
  addSection() {
    const n = this.data.sections.length, start = Math.min(0.9, n * 0.34);
    this.data.sections.push({
      heading: 'A new heading', body: 'A sentence or two about this part of the page.', cta: '', url: '',
      align: 'center', vertical: 'bottom', start: +start.toFixed(2), end: +Math.min(1, start + 0.3).toFixed(2),
    });
    this.commit();
  }
  removeSection(i: number) { this.data.sections.splice(i, 1); this.commit(); }

  // ----- timeline -----
  // Moves the playhead and poses every keyed object (and the camera) as it is at that time.
  setTime(t: number) {
    if (this.mode !== 'edit') this.setMode('edit');
    this.time = Math.max(0, Math.min(t, this.data.timeline.duration));
    if (this.rt) {
      const at = (keys: any[]) => (keys.length > 1 ? this.rt.evalKeys(keys, this.time) : keys[0]);
      this.data.objects.forEach((o: any) => {
        if (!o.keys || !o.keys.length) return;
        const k = at(o.keys);
        o.pos = k.pos.map(r3); o.rot = k.rot.map(r3); o.scale = k.scale.map(r3);
      });
      if (this.data.camKeys.length) {
        const k = at(this.data.camKeys);
        this.data.camera = { pos: k.pos.map(r3), target: k.target.map(r3) };
        this.rt.setView(this.data.camera);
      }
    }
    this.commit();
  }
  setObjectKey() {
    const o = this.selectedObject;
    if (!o) return;
    putKey(o.keys, { t: +this.time.toFixed(2), pos: o.pos.slice(), rot: o.rot.slice(), scale: o.scale.slice() });
    this.commit('Key set for ' + labelOf(o) + ' at ' + this.time.toFixed(2) + 's');
  }
  setCameraKey() {
    putKey(this.data.camKeys, { t: +this.time.toFixed(2), pos: this.data.camera.pos.slice(), target: this.data.camera.target.slice() });
    this.commit('Camera key set at ' + this.time.toFixed(2) + 's');
  }
  removeKey(list: any[], i: number) { list.splice(i, 1); this.commit(); }
}
