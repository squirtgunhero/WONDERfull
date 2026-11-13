// The scene model: what a scene and its objects look like as plain data, the built-in templates,
// and helpers that keep saved scenes valid. Nothing here touches the page or three.js.

export const NAMES = { box: 'Box', sphere: 'Sphere', cylinder: 'Cylinder', cone: 'Cone', torus: 'Torus', capsule: 'Capsule', knot: 'Knot', text: 'Flat text', text3d: '3D text', particles: 'Particles', cord: 'Cord', model: 'Model' };
export const clone = (v) => JSON.parse(JSON.stringify(v));
let uidN = 0;
export const uid = () => 'o' + Date.now().toString(36) + (uidN++);

export function mk(type, over) {
  const o = {
    id: uid(), name: NAMES[type], type, pos: [0, 0.6, 0], rot: [0, 0, 0], scale: [1, 1, 1],
    mat: { color: '#ff4f2e', roughness: 0.4, metalness: 0, glow: 0, opacity: 1, glass: 0, surface: 'none', texScale: 1 },
    anim: { kind: 'none', speed: 1, amount: 0.5 }, follow: 0,
    hover: { on: false, scale: 1.1, lift: 0, spin: 0, tint: false, color: '#ffffff' },
    click: { on: false, action: 'toggle', target: '', scale: 1, lift: 0, spin: 0, tint: false, color: '#ffffff', url: '' },
    scroll: { on: false, start: 0, end: 1, move: [0, 0, 0], spin: 0, scale: 1, activate: false },
    keys: []
  };
  Object.keys(over || {}).forEach((k) => {
    if (o[k] && typeof o[k] === 'object' && !Array.isArray(o[k])) Object.assign(o[k], over[k]); else o[k] = over[k];
  });
  return o;
}

export function starter() {
  return {
    bg: '#e9dfc9', env: 0.7, key: 2.2, keyAngle: -35, shadow: 0.25, fov: 35, drift: 0.5, orbit: false, bloom: 0, modelBase: '/models/',
    scrollCam: { on: true, orbit: -40, zoom: 1.12, rise: 0.9 }, scrollLen: 3,
    timeline: { duration: 4, mode: 'loop', trigger: 'load' }, camKeys: [],
    camera: { pos: [3.4, 2.5, 5.6], target: [0.1, 0.75, 0] },
    objects: [
      mk('text3d', { id: 's0', name: 'Wordmark', text: 'Jersey Proper', depth: 0.22, bevel: 0.03, pos: [0.1, 2.15, -0.7], scale: [0.62, 0.62, 0.62], mat: { color: '#143b29', roughness: 0.45 }, follow: 0.25,
        scroll: { on: true, start: 0, end: 0.5, move: [0, 0.3, 0], scale: 1.1 } }),
      mk('box', { id: 's1', name: 'Green box', pos: [-1.15, 0.5, 0], rot: [0, 25, 0], mat: { color: '#2f7d4f', roughness: 0.45 },
        hover: { on: true, scale: 1.08, lift: 0.15 }, click: { on: true, target: 's2', spin: 90, tint: true, color: '#ff4f2e' } }),
      mk('sphere', { id: 's2', name: 'Tomato', pos: [0.15, 0.75, 0.3], mat: { color: '#ff4f2e', roughness: 0.22 },
        anim: { kind: 'float', speed: 1, amount: 0.5 }, hover: { on: true, scale: 1.15 }, click: { on: true, scale: 1.3, tint: true, color: '#f2c14e' } }),
      mk('torus', { id: 's3', name: 'Pine ring', pos: [1.35, 0.7, -0.3], rot: [0, -30, 0], mat: { color: '#143b29', roughness: 0.3, metalness: 0.2 },
        anim: { kind: 'spin', speed: 0.6, amount: 0.5 }, hover: { on: true, scale: 1.1, lift: 0.2 },
        scroll: { on: true, start: 0.2, end: 1, move: [0.7, 0.5, 0], spin: 180 } }),
      mk('capsule', { id: 's4', name: 'Pill', pos: [1.0, 0.26, 1.15], rot: [0, 30, 90], scale: [0.7, 0.7, 0.7], mat: { color: '#f2c14e', roughness: 0.35 },
        hover: { on: true, scale: 1.12, spin: 40 },
        scroll: { on: true, start: 0, end: 0.8, move: [0.4, 0, 0.6], spin: 120 } }),
      mk('cone', { id: 's5', name: 'Cone', pos: [-0.5, 0.33, 1.2], scale: [0.6, 0.6, 0.6], mat: { color: '#ff8a5c', roughness: 0.5 },
        anim: { kind: 'wobble', speed: 1, amount: 0.3 }, hover: { on: true, scale: 1.15, lift: 0.1 },
        scroll: { on: true, start: 0.3, end: 1, move: [-0.6, 0, 0.3] },
        keys: [
          { t: 0, pos: [-0.5, 0.33, 1.2], rot: [0, 0, 0], scale: [0.6, 0.6, 0.6] },
          { t: 2, pos: [-0.5, 1.0, 1.2], rot: [0, 180, 0], scale: [0.6, 0.6, 0.6] },
          { t: 4, pos: [-0.5, 0.33, 1.2], rot: [0, 360, 0], scale: [0.6, 0.6, 0.6] }
        ] })
    ]
  };
}

export function jerseyHero() {
  const cream = '#f1ede2';
  const word = (i, text) => mk('text3d', { id: 'w' + i, name: text, text, depth: 0.08, bevel: 0.015, pos: [-7.0, 1.95 - i * 0.4, -0.3], scale: [0.28, 0.28, 0.28],
    mat: { color: cream, roughness: 0.5 }, hover: { on: true, scale: 1.08, tint: true, color: '#ff4f2e' },
    scroll: { on: true, start: i * 0.14, end: i * 0.14 + 0.3, move: [4.9, 0, 0] } });
  return {
    bg: '#12241b', env: 0.45, key: 1.2, keyAngle: -30, shadow: 0.45, fov: 35, drift: 0.5, orbit: false, bloom: 0.8, phoneZoom: 0.88, modelBase: '/models/',
    scrollCam: { on: true, orbit: -12, zoom: 0.9, rise: -0.3 }, scrollLen: 3,
    timeline: { duration: 4, mode: 'loop', trigger: 'load' }, camKeys: [],
    page: { color: '#f1ede2', accent: '#ff5a36' },
    sections: [
      { heading: 'A boutique creative studio.', body: 'Brand, web, lead gen, strategy and automation. Built in Jersey.', cta: 'Start with an audit', url: 'https://jerseyproper.com', align: 'center', vertical: 'bottom', start: 0, end: 0.3 },
      { heading: 'What we do', body: 'Brand, web, lead gen, strategy, automation.', cta: '', url: '', align: 'right', vertical: 'middle', start: 0.4, end: 0.76 },
      { heading: 'Plug in.', body: 'Every engagement starts with an audit.', cta: 'Start with an audit', url: 'https://jerseyproper.com', align: 'center', vertical: 'bottom', start: 0.84, end: 1 }
    ],
    camera: { pos: [0, 2.3, 9.2], target: [0, 2.1, 0] },
    objects: [
      mk('box', { id: 'j0', name: 'Wall', pos: [0, 3, -0.6], scale: [14, 7, 0.3], mat: { color: '#1d4a34', roughness: 0.9, surface: 'brick', texScale: 0.7 } }),
      mk('text3d', { id: 'j1', name: 'Sign', text: 'Jersey Proper', depth: 0.12, bevel: 0.02, pos: [0, 3.1, -0.25], scale: [0.8, 0.8, 0.8],
        mat: { color: '#ff4f2e', roughness: 0.4, glow: 0.5 }, anim: { kind: 'flicker', speed: 1, amount: 0.5 }, follow: 0.08,
        click: { tint: true, color: '#3a1a12' } }),
      mk('text', { id: 'j2', name: 'Tagline', text: 'Built in Jersey', pos: [0, 2.2, -0.3], scale: [0.5, 0.5, 0.5], mat: { color: cream, roughness: 0.6, glow: 0.15 } }),
      mk('cord', { id: 'j3', name: 'Cord', pos: [2.2, 2.75, -0.36], to: [1.0, -1.93, 0.06], slack: 0.5, thick: 0.018, mat: { color: '#111111', roughness: 0.5 } }),
      mk('box', { id: 'j4', name: 'Outlet', pos: [3.2, 0.74, -0.42], scale: [0.28, 0.42, 0.06], mat: { color: '#e9e4d8', roughness: 0.5 } }),
      mk('box', { id: 'j5', name: 'Plug', pos: [3.2, 0.82, -0.35], scale: [0.14, 0.14, 0.1], mat: { color: '#161616', roughness: 0.45 },
        hover: { on: true, scale: 1.25 }, click: { on: true, target: 'j1' } }),
      word(0, 'Brand'), word(1, 'Web'), word(2, 'Lead gen'), word(3, 'Strategy'), word(4, 'Automation'),
      mk('particles', { id: 'j6', name: 'Dust', pos: [0, 2.2, 0.8], count: 120, spread: 6, speed: 0.25, psize: 0.05, mat: { color: '#f2c14e', opacity: 0.6, glow: 0.3 } })
    ]
  };
}
export const TEMPLATES = [['Starter shapes', starter], ['Jersey Proper hero', jerseyHero]];

// Fills in anything an older saved scene is missing.
export function normalize(data) {
  if (!data.scrollCam) data.scrollCam = { on: false, orbit: 0, zoom: 1, rise: 0 };
  if (!data.scrollLen) data.scrollLen = 3;
  if (data.phoneZoom == null) data.phoneZoom = 1;
  if (!Array.isArray(data.sections)) data.sections = [];
  if (!data.page) {
    // Dark text on light scenes, light text on dark ones.
    const hex = (data.bg || '#000000').replace('#', ''), n = parseInt(hex.length === 3 ? hex.replace(/./g, '$&$&') : hex, 16);
    const light = (0.299 * (n >> 16 & 255) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255)) > 150;
    data.page = { color: light ? '#14261c' : '#f1ede2', accent: '#ff5a36' };
  }
  if (!data.timeline) data.timeline = { duration: 4, mode: 'loop', trigger: 'load' };
  if (!Array.isArray(data.camKeys)) data.camKeys = [];
  data.objects = data.objects.map((o) => mk(o.type, o));
}

// The parts of an object that require rebuilding its 3D shape when they change.
export const objectSig = (o) => [o.type, o.text, o.depth, o.bevel, o.file, o.count, o.slack, o.thick, (o.to || []).join(','), (o.mat || {}).surface].join('|');

// Adds a keyframe, replacing any key at the same time, and keeps the list in time order.
export function putKey(list, key) {
  for (let i = list.length - 1; i >= 0; i--) if (Math.abs(list[i].t - key.t) < 0.03) list.splice(i, 1);
  list.push(key);
  list.sort((a, b) => a.t - b.t);
}
