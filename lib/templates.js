// The template library: ready-made scenes to start from, and ready-made objects to drop into a scene.
// Everything here is plain scene data built from the same objects the editor offers.
import { mk, neonSign, starter } from './scene.js';

const scene = (over) => ({
  bg: '#eceef2', env: 0.75, key: 2.2, keyAngle: -35, shadow: 0.22, fov: 35, drift: 0.4, orbit: false, bloom: 0, modelBase: '/models/',
  scrollCam: { on: false, orbit: 0, zoom: 1, rise: 0 }, scrollLen: 3, timeline: { duration: 4, mode: 'loop', trigger: 'load' }, camKeys: [],
  camera: { pos: [3.4, 2.5, 5.6], target: [0.1, 0.75, 0] }, objects: [], ...over,
});

// ----- objects: each returns parts that share one group and sit on the floor around the origin -----
function lamp() {
  const g = 'Desk lamp', dark = '#23262d';
  return [
    mk('cylinder', { id: 'lampBase', name: 'Base', group: g, pos: [0, 0.05, 0], scale: [0.7, 0.1, 0.7], mat: { color: dark, roughness: 0.3, metalness: 0.6 } }),
    mk('cylinder', { id: 'lampStem', name: 'Stem', group: g, pos: [0, 0.75, 0], scale: [0.07, 1.3, 0.07], mat: { color: dark, roughness: 0.3, metalness: 0.6 } }),
    mk('dome', { id: 'lampShade', name: 'Shade (tap to switch)', group: g, pos: [0, 1.5, 0], scale: [0.9, 0.9, 0.9], mat: { color: '#f2c14e', roughness: 0.5 },
      hover: { on: true, scale: 1.04 }, click: { on: true, target: 'lampLight' } }),
    mk('sphere', { id: 'lampBulb', name: 'Bulb', group: g, pos: [0, 1.32, 0], scale: [0.22, 0.22, 0.22], mat: { color: '#fff1c9', glow: 1.6 } }),
    mk('light', { id: 'lampLight', name: 'Lamp light', group: g, pos: [0, 1.2, 0], power: 10, reach: 7, mat: { color: '#ffd9a0' }, click: { tint: true, color: '#000000' } }),
  ];
}
function plant() {
  const g = 'Potted plant', leaf = (id, pos, rot, s) => mk('sphere', { id, name: 'Leaf', group: g, pos, rot, scale: [0.28 * s, 0.6 * s, 0.1 * s], mat: { color: '#3f9d5b', roughness: 0.6 }, anim: { kind: 'wobble', speed: 0.5, amount: 0.15 } });
  return [
    mk('cylinder', { id: 'plantPot', name: 'Pot', group: g, pos: [0, 0.3, 0], scale: [0.62, 0.6, 0.62], mat: { color: '#c96f4a', roughness: 0.85, surface: 'plaster' } }),
    mk('cylinder', { id: 'plantSoil', name: 'Soil', group: g, pos: [0, 0.59, 0], scale: [0.54, 0.04, 0.54], mat: { color: '#3b2a20', roughness: 1 } }),
    leaf('plantL1', [0, 1.0, 0], [0, 0, 0], 1.2), leaf('plantL2', [-0.26, 0.9, 0.05], [0, 30, 32], 1), leaf('plantL3', [0.27, 0.88, -0.04], [0, -20, -34], 1), leaf('plantL4', [0.05, 0.86, 0.24], [30, 80, 10], 0.9),
  ];
}
function trophy() {
  const g = 'Trophy', gold = { color: '#e3b23c', roughness: 0.22, metalness: 0.9 };
  return [
    mk('box', { id: 'trophyBase', name: 'Plinth', group: g, pos: [0, 0.15, 0], scale: [0.8, 0.3, 0.8], mat: { color: '#1c1d21', roughness: 0.35 } }),
    mk('cylinder', { id: 'trophyStem', name: 'Stem', group: g, pos: [0, 0.55, 0], scale: [0.12, 0.5, 0.12], mat: gold }),
    mk('dome', { id: 'trophyCup', name: 'Cup', group: g, pos: [0, 1.1, 0], rot: [180, 0, 0], scale: [0.85, 1.1, 0.85], mat: gold }),
    mk('arch', { id: 'trophyH1', name: 'Handle', group: g, pos: [-0.5, 1.12, 0], rot: [0, 0, 90], scale: [0.5, 0.5, 0.5], mat: gold }),
    mk('arch', { id: 'trophyH2', name: 'Handle', group: g, pos: [0.5, 1.12, 0], rot: [0, 0, -90], scale: [0.5, 0.5, 0.5], mat: gold }),
    mk('star', { id: 'trophyStar', name: 'Star', group: g, pos: [0, 1.85, 0], scale: [0.45, 0.45, 0.45], mat: { color: '#f4cf6a', glow: 0.25, metalness: 0.6, roughness: 0.25 }, anim: { kind: 'float', speed: 0.8, amount: 0.25 }, follow: 0.5 }),
  ];
}
function pushButton() {
  const g = 'Push button';
  return [
    mk('box', { id: 'btnBase', name: 'Housing', group: g, pos: [0, 0.1, 0], scale: [1.5, 0.2, 0.9], mat: { color: '#d9dce2', roughness: 0.5 } }),
    mk('box', { id: 'btnCap', name: 'Cap (tap it)', group: g, pos: [0, 0.3, 0], scale: [1.3, 0.24, 0.7], mat: { color: '#2438f5', roughness: 0.3 },
      hover: { on: true, scale: 1.03, lift: 0.03 }, click: { on: true, lift: -0.09, tint: true, color: '#18b86b' } }),
    mk('text', { id: 'btnLabel', name: 'Label', group: g, text: 'Press', pos: [0, 0.44, 0], rot: [-90, 0, 0], scale: [0.36, 0.36, 0.36], mat: { color: '#ffffff', roughness: 0.6 } }),
  ];
}
export const PARTS = [['Desk lamp', lamp], ['Potted plant', plant], ['Trophy', trophy], ['Push button', pushButton]];
const shift = (parts, x, z) => parts.map((o) => { o.pos = [o.pos[0] + x, o.pos[1], o.pos[2] + z]; return o; });

// ----- scenes -----
function glassType() {
  const line = (i, text) => mk('text3d', { id: 'gt' + i, name: text, text, depth: 0.05, bevel: 0, pos: [0, 3.4 - i, -0.6], scale: [0.9, 0.9, 0.9], mat: { color: '#e8e8e8', roughness: 0.6 } });
  const orb = (i, pos, s) => mk('sphere', { id: 'go' + i, name: 'Glass orb', pos, scale: [s, s, s], mat: { color: '#f4f6ff', roughness: 0.03, glass: 1, bend: 1.6, rainbow: 0.8 },
    anim: { kind: 'float', speed: 0.5 + i * 0.15, amount: 0.4 }, follow: 0.2, hover: { on: true, scale: 1.08 } });
  return scene({
    bg: '#121212', env: 0.9, key: 1.2, shadow: 0, drift: 0.6, phoneZoom: 0.8, camera: { pos: [0, 1.9, 9], target: [0, 1.9, 0] },
    grade: { exposure: 1, contrast: 1.1, saturation: 1, vignette: 0.5, tint: '#ffffff' },
    objects: [line(0, 'BENDING'), line(1, 'LIGHT WITH'), line(2, 'CLEAR GLASS'), line(3, 'AND TYPE'), orb(0, [0.4, 2.3, 1.2], 1.5), orb(1, [-2.2, 2.2, 0.8], 0.8), orb(2, [1.5, 0.9, 1.4], 0.6)],
  });
}
function tumblingBlocks() {
  const colors = ['#2438f5', '#ffb400', '#ff6a3d', '#8fdcc0'], objects = [];
  for (let row = 0; row < 4; row++) for (let col = 0; col < 3; col++) {
    objects.push(mk('box', { id: 'tb' + row + col, name: 'Block', group: 'Tower', pos: [(col - 1) * 0.72 + (row % 2 ? 0.18 : 0), 0.35 + row * 0.7, 0], scale: [0.7, 0.7, 0.7],
      mat: { color: colors[(row + col) % 4], roughness: 0.45 }, body: 'falls', bounce: 0.1, hover: { on: true, tint: true, color: '#ffffff' } }));
  }
  objects.push(mk('sphere', { id: 'tbBall', name: 'Heavy ball', pos: [5.0, 2.9, 0], scale: [1, 1, 1], mat: { color: '#14161a', roughness: 0.2, metalness: 0.7 }, body: 'falls', weight: 8, bounce: 0.1 }));
  objects.push(mk('box', { id: 'tbRamp', name: 'Ramp', pos: [3.5, 1.0, 0], rot: [0, 0, 24], scale: [4, 0.15, 1.4], mat: { color: '#d9dce2', roughness: 0.6 }, body: 'solid' }));
  return scene({ ao: 0.5, camera: { pos: [6.5, 3.8, 9.5], target: [1.6, 1.3, 0] }, objects });
}
function duskLighthouse() {
  return scene({
    bg: '#1b2440', env: 0.5, key: 1.4, keyAngle: 60, shadow: 0.4, bloom: 0.8, phoneZoom: 0.88, camera: { pos: [5.5, 3.2, 8.5], target: [0, 2.2, 0] },
    scrollCam: { on: true, orbit: 50, zoom: 0.85, rise: 0.6 }, page: { color: '#f2ead8', accent: '#ffb347' },
    fog: { on: true, color: '#1b2440', near: 9, far: 26 },
    sections: [{ heading: 'Keep the light.', body: 'A small tower, a slow beam, and the sea going dark around it.', cta: '', url: '', align: 'left', vertical: 'bottom', start: 0, end: 0.4 }],
    objects: [
      mk('sphere', { id: 'lhRock', name: 'Rock', pos: [0, 0.1, 0], scale: [3.2, 0.9, 2.6], mat: { color: '#3a3f4a', roughness: 0.95, surface: 'plaster' } }),
      mk('cylinder', { id: 'lhTower', name: 'Tower', group: 'Lighthouse', pos: [0, 2.1, 0], scale: [0.9, 3.2, 0.9], mat: { color: '#f2ead8', roughness: 0.7 } }),
      mk('cylinder', { id: 'lhBand', name: 'Red band', group: 'Lighthouse', pos: [0, 2.2, 0], scale: [0.93, 0.7, 0.93], mat: { color: '#c8402c', roughness: 0.6 } }),
      mk('cylinder', { id: 'lhGallery', name: 'Gallery', group: 'Lighthouse', pos: [0, 3.78, 0], scale: [1.25, 0.12, 1.25], mat: { color: '#22252c', metalness: 0.6, roughness: 0.3 } }),
      mk('sphere', { id: 'lhLamp', name: 'Lamp', group: 'Lighthouse', pos: [0, 4.15, 0], scale: [0.5, 0.5, 0.5], mat: { color: '#ffd27a', glow: 2.2 }, anim: { kind: 'pulse', speed: 0.6, amount: 0.4 }, hover: { on: true, scale: 1.2 }, click: { on: true, tint: true, color: '#3a2a12' } }),
      mk('cone', { id: 'lhBeam', name: 'Beam', group: 'Lighthouse', pos: [0, 4.15, 0], rot: [0, 0, 90], scale: [0.5, 5, 0.5], mat: { color: '#ffe6a8', glow: 0.8, opacity: 0.18 }, anim: { kind: 'spin', speed: 0.5, amount: 1 } }),
      mk('cone', { id: 'lhRoof', name: 'Roof', group: 'Lighthouse', pos: [0, 4.75, 0], scale: [0.75, 0.55, 0.75], mat: { color: '#c8402c', roughness: 0.5 } }),
      mk('particles', { id: 'lhMist', name: 'Mist', pos: [0, 1.6, 0], count: 260, spread: 8, psize: 0.07, speed: 0.15, mat: { color: '#c9d6ff', opacity: 0.5 } }),
    ],
  });
}
function hillsAtDawn() {
  const objects = [mk('box', { id: 'hdGround', name: 'Ground', pos: [0, -0.25, -10], scale: [40, 0.5, 40], mat: { color: '#7fae6a', roughness: 0.95 } })];
  for (let i = 0; i < 7; i++) objects.push(mk('pyramid', { id: 'hdHill' + i, name: 'Hill', group: 'Hills', pos: [-6 + i * 2.4, 1 + 0.3 * (i % 3), -2 - i * 3.5], rot: [0, i * 20, 0], scale: [2.5, 2 + 0.6 * (i % 3), 2.5], mat: { color: '#c9b08a', roughness: 0.9 } }));
  objects.push(mk('sphere', { id: 'hdSun', name: 'Sun', pos: [-4, 5.5, -24], scale: [3, 3, 3], mat: { color: '#ffd9a0', glow: 1.2 } }));
  objects.push(...shift(plant(), 0.2, 1.4));
  return scene({
    bg: '#dfe9ff', env: 0.8, key: 2.4, keyAngle: -50, shadow: 0.3, ao: 0.5, fov: 40, bloom: 0.4, camera: { pos: [5, 3, 9], target: [0, 1, 0] },
    sky: { on: true, top: '#2f6fe0', bottom: '#f3d9b8' }, fog: { on: true, color: '#f3d9b8', near: 8, far: 30 },
    scrollCam: { on: true, orbit: -30, zoom: 0.8, rise: 0.4 }, page: { color: '#22304a', accent: '#ff6a3d' },
    sections: [
      { heading: 'Morning, slowly.', body: 'Sky, fog and soft shadows do most of the work in an outdoor scene.', cta: '', url: '', align: 'left', vertical: 'top', start: 0, end: 0.45 },
      { heading: 'Make it yours.', body: 'Change the two sky colors in the Scene tab and the whole mood follows.', cta: '', url: '', align: 'left', vertical: 'top', start: 0.55, end: 1 },
    ],
    objects,
  });
}
function deskSet() {
  return scene({
    bg: '#2a2d36', env: 0.25, key: 0.5, shadow: 0.4, ao: 0.6, bloom: 0.5, camera: { pos: [3.2, 2.6, 5.2], target: [0, 0.9, 0] }, orbit: true,
    objects: [mk('box', { id: 'dsTop', name: 'Desk', pos: [0, -0.1, 0], scale: [5, 0.2, 3], mat: { color: '#8a6a4b', roughness: 0.7, surface: 'ribbed', texScale: 0.4 } }),
      ...shift(lamp(), -1.1, -0.2), ...shift(plant(), 1.3, -0.4), ...shift(trophy(), 0.2, -0.7), ...shift(pushButton(), 0, 0.9)],
  });
}

// ----- motion -----
function orbitingRings() {
  // Each ring turns about a different axis, so they never line up edge-on together.
  const turns = [[360, 0, 0], [0, 360, 0], [-360, 360, 0]], tilt = [[0, 0, 0], [70, 0, 0], [35, 0, 60]];
  const ring = (i, s, color) => {
    const at = (f) => [tilt[i][0] + turns[i][0] * f, tilt[i][1] + turns[i][1] * f, tilt[i][2] + turns[i][2] * f];
    return mk('torus', { id: 'or' + i, name: 'Ring ' + (i + 1), pos: [0, 1.8, 0], rot: at(0), scale: [s, s, s * 0.5], mat: { color, roughness: 0.2, metalness: 0.8 },
      keys: [0, 0.25, 0.5, 0.75, 1].map((f) => ({ t: f * 6, pos: [0, 1.8, 0], rot: at(f), scale: [s, s, s * 0.5] })) });
  };
  return scene({
    bg: '#0f1118', env: 1, key: 1.5, shadow: 0.3, bloom: 0.6, timeline: { duration: 6, mode: 'loop', trigger: 'load' }, camera: { pos: [0, 2.2, 7], target: [0, 1.8, 0] },
    objects: [ring(0, 1.2, '#e3b23c'), ring(1, 1.75, '#d9dce2'), ring(2, 2.3, '#2438f5'), mk('sphere', { id: 'orCore', name: 'Core', pos: [0, 1.8, 0], scale: [0.55, 0.55, 0.55], mat: { color: '#ff6a3d', glow: 1.4 }, anim: { kind: 'pulse', speed: 0.8, amount: 0.6 } })],
  });
}
function scrollStory() {
  const stop = (i, type, color, text) => [
    mk(type, { id: 'ss' + i, name: text, pos: [i * 6, 1, 0], mat: { color, roughness: 0.3 }, anim: { kind: i === 1 ? 'spin' : 'float', speed: 0.7, amount: 0.5 }, hover: { on: true, scale: 1.15 } }),
    mk('text3d', { id: 'sst' + i, name: text + ' title', text, depth: 0.1, bevel: 0.02, pos: [i * 6, 2.5, -0.4], scale: [0.5, 0.5, 0.5], mat: { color: '#14161a' } }),
  ];
  return scene({
    scrollLen: 4, timeline: { duration: 6, mode: 'once', trigger: 'scroll' }, camera: { pos: [0, 1.8, 6.5], target: [0, 1.3, 0] }, ao: 0.4,
    camKeys: [{ t: 0, pos: [0, 1.8, 6.5], target: [0, 1.3, 0] }, { t: 3, pos: [6, 1.8, 6.5], target: [6, 1.3, 0] }, { t: 6, pos: [12, 1.8, 6.5], target: [12, 1.3, 0] }],
    page: { color: '#14161a', accent: '#2438f5' },
    sections: [
      { heading: 'Scroll to travel.', body: 'The camera follows keys on the timeline, and the timeline follows the scroll.', cta: '', url: '', align: 'center', vertical: 'bottom', start: 0, end: 0.28 },
      { heading: 'Each stop gets a line.', body: 'Sections fade in for the stretch of scroll you give them.', cta: '', url: '', align: 'center', vertical: 'bottom', start: 0.38, end: 0.64 },
      { heading: 'End on an ask.', body: 'The last section is a good place for a button.', cta: 'Get in touch', url: '#', align: 'center', vertical: 'bottom', start: 0.76, end: 1 },
    ],
    objects: [...stop(0, 'sphere', '#ffb400', 'One'), ...stop(1, 'knot', '#2438f5', 'Two'), ...stop(2, 'heart', '#ff4f6d', 'Three')],
  });
}
function pressMe() {
  return scene({ camera: { pos: [1.8, 2.4, 3.6], target: [0, 0.3, 0] }, ao: 0.5, objects: pushButton() });
}
const one = (parts, cam) => () => scene({ camera: cam, orbit: true, ao: 0.4, objects: parts() });

// label, kind, what it shows, how to make it
export const LIBRARY = [
  { label: 'Starter shapes', kind: 'Scenes', about: 'A handful of objects with hover, click and scroll already set up.', make: starter },
  { label: 'Glass and type', kind: 'Scenes', about: 'Clear orbs that bend the lettering behind them.', make: glassType },
  { label: 'Neon sign', kind: 'Scenes', about: 'A glowing sign on a brick wall with text that follows the scroll.', make: neonSign },
  { label: 'Dusk lighthouse', kind: 'Scenes', about: 'A night scene with glow, fog, mist and a turning beam.', make: duskLighthouse },
  { label: 'Hills at dawn', kind: 'Scenes', about: 'Sky, fog and soft shadows for an outdoor page.', make: hillsAtDawn },
  { label: 'Tumbling blocks', kind: 'Scenes', about: 'A tower, a heavy ball and gravity. Press Play.', make: tumblingBlocks },
  { label: 'Desk set', kind: 'Scenes', about: 'A lamp you can switch, a plant, a trophy and a button on a desk.', make: deskSet },
  { label: 'Desk lamp', kind: 'Objects', about: 'Tap the shade to switch the light.', make: one(lamp, { pos: [2.4, 2, 3.6], target: [0, 0.9, 0] }) },
  { label: 'Potted plant', kind: 'Objects', about: 'Leaves that sway.', make: one(plant, { pos: [2, 1.6, 3], target: [0, 0.7, 0] }) },
  { label: 'Trophy', kind: 'Objects', about: 'Polished gold with a spinning star.', make: one(trophy, { pos: [2.4, 2, 3.8], target: [0, 1, 0] }) },
  { label: 'Orbiting rings', kind: 'Motion', about: 'A seamless loop made with timeline keys.', make: orbitingRings },
  { label: 'Scroll story', kind: 'Motion', about: 'The camera travels between three stops as the page scrolls.', make: scrollStory },
  { label: 'Press me', kind: 'Motion', about: 'A button with hover and pressed states.', make: pressMe },
];
