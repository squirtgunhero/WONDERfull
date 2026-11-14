// Turns whatever a language model returns into a scene the editor can trust.
// Every number is clamped to the range its control allows, every color and link is checked,
// unknown fields are dropped, and imported models survive only if the current scene has them.
// Nothing here touches the page or the network, so it runs the same on the server and in tests.
import { mk } from '../scene.js';

export const AI_TYPES = ['box', 'sphere', 'cylinder', 'cone', 'torus', 'capsule', 'knot', 'pyramid', 'dome', 'arch', 'star', 'heart', 'text', 'text3d', 'particles', 'cord', 'light'];
const MAX_LIGHTS = 8;
export const MAX_OBJECTS = 80;
const MAX_SECTIONS = 8, MAX_KEYS = 16;

const r3 = (n) => Math.round(n * 1000) / 1000;
const num = (v, min, max, def) => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) : NaN;
  return Number.isFinite(n) ? r3(Math.min(max, Math.max(min, n))) : def;
};
const vec = (v, min, max, def) => (Array.isArray(v) && v.length >= 3 ? [0, 1, 2].map((i) => num(v[i], min, max, def[i])) : def.slice());
const size = (v) => (typeof v === 'number' ? vec([v, v, v], 0.01, 40, [1, 1, 1]) : vec(v, 0.01, 40, [1, 1, 1]));
const str = (v, max, def = '') => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) : def);
const pick = (v, list, def) => (list.includes(v) ? v : def);
const bool = (v, def) => (typeof v === 'boolean' ? v : def);
const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
export const color = (v, def) => {
  if (typeof v !== 'string') return def;
  let s = v.trim().toLowerCase();
  if (/^#[0-9a-f]{3}$/.test(s)) s = '#' + s.slice(1).replace(/./g, '$&$&');
  return /^#[0-9a-f]{6}$/.test(s) ? s : def;
};
// Links may only go to web pages, places on this page, or an email address.
export const link = (v) => {
  const s = str(v, 300);
  return /^(https?:\/\/|\/|#|mailto:)/i.test(s) ? s : '';
};

// Copies only the listed fields that the source actually has, each through its own check.
function part(src, spec) {
  const out = {};
  src = obj(src);
  for (const k of Object.keys(spec)) if (src[k] !== undefined && src[k] !== null) out[k] = spec[k](src[k]);
  return out;
}
const state = {
  on: (v) => bool(v, false), scale: (v) => num(v, 0.5, 2, 1), lift: (v) => num(v, -1, 1, 0), spin: (v) => num(v, -180, 180, 0),
  tint: (v) => bool(v, false), color: (v) => color(v, '#ffffff'),
};

function cleanKeys(list, duration, shape) {
  if (!Array.isArray(list)) return [];
  const keys = [];
  for (const k of list.slice(0, MAX_KEYS * 2)) {
    if (!k || typeof k !== 'object') continue;
    const key = { t: num(k.t, 0, duration, 0), ...shape(k) };
    if (!keys.some((x) => Math.abs(x.t - key.t) < 0.03)) keys.push(key);
  }
  return keys.sort((a, b) => a.t - b.t).slice(0, MAX_KEYS);
}

function cleanObject(src, type, duration) {
  const over = part(src, {
    name: (v) => str(v, 30),
    group: (v) => str(v, 30),
    pos: (v) => vec(v, -60, 60, [0, 0.6, 0]),
    rot: (v) => vec(v, -3600, 3600, [0, 0, 0]),
    scale: size,
    follow: (v) => num(v, 0, 1, 0),
  });
  if (!over.name) delete over.name;
  over.mat = part(src.mat, {
    color: (v) => color(v, '#ff4f2e'), roughness: (v) => num(v, 0, 1, 0.4), metalness: (v) => num(v, 0, 1, 0), glow: (v) => num(v, 0, 3, 0),
    opacity: (v) => num(v, 0.05, 1, 1), glass: (v) => num(v, 0, 1, 0), surface: (v) => pick(v, ['none', 'brick', 'plaster', 'ribbed'], 'none'), texScale: (v) => num(v, 0.1, 3, 1),
  });
  over.anim = part(src.anim, {
    kind: (v) => pick(v, ['none', 'float', 'spin', 'wobble', 'pulse', 'flicker'], 'none'), speed: (v) => num(v, 0.1, 3, 1), amount: (v) => num(v, 0, 2, 0.5),
  });
  over.hover = part(src.hover, state);
  over.click = part(src.click, { ...state, scale: (v) => num(v, 0.5, 2, 1), action: (v) => pick(v, ['toggle', 'link'], 'toggle'), target: (v) => str(v, 40), url: link });
  over.scroll = part(src.scroll, {
    on: (v) => bool(v, false), start: (v) => num(v, 0, 1, 0), end: (v) => num(v, 0, 1, 1), move: (v) => vec(v, -30, 30, [0, 0, 0]),
    spin: (v) => num(v, -360, 360, 0), scale: (v) => num(v, 0.2, 3, 1), activate: (v) => bool(v, false),
  });
  over.keys = cleanKeys(src.keys, duration, (k) => ({ pos: vec(k.pos, -60, 60, over.pos || [0, 0.6, 0]), rot: vec(k.rot, -3600, 3600, over.rot || [0, 0, 0]), scale: size(k.scale === undefined ? over.scale : k.scale) }));
  if (type === 'text' || type === 'text3d') over.text = str(src.text, 28) || 'Text';
  if (type === 'text3d') { over.depth = num(src.depth, 0.02, 1.5, 0.25); over.bevel = num(src.bevel, 0, 0.12, 0.03); }
  if (type === 'cord') { over.to = vec(src.to, -60, 60, [1, -1.5, 0]); over.slack = num(src.slack, 0, 1.5, 0.4); over.thick = num(src.thick, 0.005, 0.1, 0.02); }
  if (type === 'light') { over.power = num(src.power, 0, 40, 8); over.reach = num(src.reach, 0, 30, 8); }
  if (type === 'particles') {
    over.count = Math.round(num(src.count, 20, 1000, 200)); over.spread = num(src.spread, 0.5, 8, 3);
    over.psize = num(src.psize, 0.01, 0.25, 0.06); over.speed = num(src.speed, 0, 2, 0.4);
  }
  const o = mk(type, over);
  if (o.scroll.end < o.scroll.start) o.scroll.end = o.scroll.start;
  return o;
}

const DEFAULTS = {
  bg: '#eceef2', env: 0.75, key: 2.2, keyAngle: -35, shadow: 0.22, bloom: 0, fov: 35, drift: 0.5, phoneZoom: 1, orbit: false,
  scrollCam: { on: false, orbit: 0, zoom: 1, rise: 0 }, scrollLen: 3,
  timeline: { duration: 4, mode: 'loop', trigger: 'load' },
  camera: { pos: [3.4, 2.5, 5.6], target: [0.1, 0.75, 0] },
};

// raw: the scene the model returned. current: the scene being edited, if any.
// Throws when raw has no object list at all, which means the model did not return a scene.
export function sanitizeScene(raw, current) {
  if (typeof raw === 'string') { try { raw = JSON.parse(raw); } catch (e) { raw = null; } }
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.objects)) throw new Error('not a scene');
  const d = { ...DEFAULTS, ...obj(current) };
  const dc = obj(d.scrollCam), dt = obj(d.timeline), dcam = obj(d.camera);
  const rc = obj(raw.scrollCam), rt = obj(raw.timeline), rcam = obj(raw.camera);
  const scene = {
    bg: color(raw.bg, color(d.bg, DEFAULTS.bg)),
    env: num(raw.env, 0, 2, num(d.env, 0, 2, 0.75)),
    key: num(raw.key, 0, 5, num(d.key, 0, 5, 2.2)),
    keyAngle: num(raw.keyAngle, -180, 180, num(d.keyAngle, -180, 180, -35)),
    shadow: num(raw.shadow, 0, 0.8, num(d.shadow, 0, 0.8, 0.22)),
    bloom: num(raw.bloom, 0, 2, num(d.bloom, 0, 2, 0)),
    fov: num(raw.fov, 20, 75, num(d.fov, 20, 75, 35)),
    drift: num(raw.drift, 0, 1, num(d.drift, 0, 1, 0.5)),
    phoneZoom: num(raw.phoneZoom, 0.5, 1, num(d.phoneZoom, 0.5, 1, 1)),
    orbit: bool(raw.orbit, !!d.orbit),
    modelBase: '/models/',
    scrollCam: {
      on: bool(rc.on, !!dc.on), orbit: num(rc.orbit, -180, 180, num(dc.orbit, -180, 180, 0)),
      zoom: num(rc.zoom, 0.4, 2.5, num(dc.zoom, 0.4, 2.5, 1)), rise: num(rc.rise, -3, 3, num(dc.rise, -3, 3, 0)),
    },
    scrollLen: num(raw.scrollLen, 1.5, 6, num(d.scrollLen, 1.5, 6, 3)),
    timeline: {
      duration: num(rt.duration, 1, 20, num(dt.duration, 1, 20, 4)),
      mode: pick(rt.mode, ['loop', 'pingpong', 'once'], pick(dt.mode, ['loop', 'pingpong', 'once'], 'loop')),
      trigger: pick(rt.trigger, ['load', 'scroll'], pick(dt.trigger, ['load', 'scroll'], 'load')),
    },
    camera: {
      pos: vec(rcam.pos, -80, 80, vec(dcam.pos, -80, 80, DEFAULTS.camera.pos)),
      target: vec(rcam.target, -80, 80, vec(dcam.target, -80, 80, DEFAULTS.camera.target)),
    },
  };
  const duration = scene.timeline.duration;

  // Page text. A scene that sets its own text colors keeps them; otherwise the editor picks readable ones.
  const page = raw.page === undefined ? current && current.page : raw.page;
  if (page && typeof page === 'object') scene.page = { color: color(page.color, '#14161a'), accent: color(page.accent, '#2438f5') };
  const sections = raw.sections === undefined ? (current && current.sections) || [] : raw.sections;
  scene.sections = (Array.isArray(sections) ? sections : []).filter((s) => s && typeof s === 'object').slice(0, MAX_SECTIONS).map((s) => {
    const start = num(s.start, 0, 1, 0);
    return {
      heading: str(s.heading, 80), body: str(s.body, 240), cta: str(s.cta, 30), url: link(s.url),
      align: pick(s.align, ['left', 'center', 'right'], 'center'), vertical: pick(s.vertical, ['top', 'middle', 'bottom'], 'bottom'),
      start, end: Math.max(start, num(s.end, 0, 1, 1)),
    };
  });
  scene.camKeys = cleanKeys(raw.camKeys === undefined ? current && current.camKeys : raw.camKeys, duration,
    (k) => ({ pos: vec(k.pos, -80, 80, scene.camera.pos), target: vec(k.target, -80, 80, scene.camera.target) }));

  // Objects. Ids the model reuses stay the same so links between objects and the editor's selection survive.
  const models = new Map(((current && current.objects) || []).filter((o) => o && o.type === 'model' && o.file).map((o) => [o.id, o]));
  const used = new Set(), renamed = new Map();
  let n = 0;
  const freshId = () => { let id; do { id = 'a' + (n++).toString(36); } while (used.has(id) || models.has(id)); return id; };
  scene.objects = [];
  for (const src of raw.objects) {
    if (scene.objects.length >= MAX_OBJECTS) break;
    if (!src || typeof src !== 'object') continue;
    const model = src.type === 'model' ? models.get(src.id) : null;
    if (src.type === 'model' ? !model || used.has(src.id) : !AI_TYPES.includes(src.type)) continue;
    if (src.type === 'light' && scene.objects.filter((x) => x.type === 'light').length >= MAX_LIGHTS) continue;
    const o = cleanObject(src, src.type, duration);
    const asked = typeof src.id === 'string' ? src.id : '';
    o.id = /^[A-Za-z0-9_-]{1,24}$/.test(asked) && !used.has(asked) ? asked : freshId();
    used.add(o.id);
    if (asked && !renamed.has(asked)) renamed.set(asked, o.id);
    if (model) { o.file = model.file; if (!src.name) o.name = model.name; }
    scene.objects.push(o);
  }
  // A click can only switch an object that is in the scene.
  for (const o of scene.objects) {
    const target = renamed.get(o.click.target) || '';
    o.click.target = target && target !== o.id ? target : '';
    if (o.click.action === 'link' && !o.click.url) o.click.action = 'toggle';
  }
  return scene;
}

// The short form of a scene that is sent to the model: every object field that still has its
// default value is left out, which keeps requests small. The model answers in the same form.
export function compactScene(scene) {
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const out = {};
  for (const k of ['bg', 'env', 'key', 'keyAngle', 'shadow', 'bloom', 'fov', 'drift', 'phoneZoom', 'orbit', 'scrollCam', 'scrollLen', 'timeline', 'camera', 'page', 'sections', 'camKeys']) {
    if (scene[k] !== undefined) out[k] = scene[k];
  }
  out.objects = (scene.objects || []).map((o) => {
    const base = mk(o.type, {}), c = { id: o.id, type: o.type };
    for (const k of Object.keys(o)) {
      if (k === 'id' || k === 'type') continue;
      const v = o[k], b = base[k];
      if (v && b && typeof v === 'object' && !Array.isArray(v)) {
        const sub = {};
        for (const j of Object.keys(v)) if (!same(v[j], b[j])) sub[j] = v[j];
        if (Object.keys(sub).length) c[k] = sub;
      } else if (!same(v, b)) c[k] = v;
    }
    return c;
  });
  return out;
}
