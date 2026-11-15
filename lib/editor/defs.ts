// Field definitions for the editor's panels. Each entry describes one control:
// k is the path into the target object, show decides whether it appears.
import { NAMES } from '../scene';

export type FieldDef = {
  h?: string;            // a heading instead of a control
  note?: string;         // a line of help text instead of a control
  k?: string;            // path into the target object, such as "mat.color"
  label?: string;
  type?: 'text' | 'color' | 'range' | 'uscale' | 'check' | 'select' | 'vec3';
  min?: number; max?: number; step?: number;
  def?: number;          // value shown when the target has none yet
  int?: boolean;         // show the range value as a whole number
  ph?: string;           // placeholder
  options?: string[][];  // [value, label] pairs for a select
  show?: (target: any) => boolean;
};

const notModel = (o: any) => o.type !== 'model';
const solid = (o: any) => o.type !== 'model' && o.type !== 'particles' && o.type !== 'light';
const shaped = (o: any) => solid(o) && o.type !== 'text' && o.type !== 'image' && o.type !== 'video';
// (clay behaves like any solid shape)
const canCollide = (o: any) => o.type !== 'particles' && o.type !== 'light' && o.type !== 'cord';
const shines = (o: any) => o.type !== 'model' && o.type !== 'light';
const stateLook = (s: string): FieldDef[] => {
  const vis = (o: any) => s !== 'hover' || o.hover.on;
  return [
    { k: s + '.scale', label: 'Size', type: 'range', min: 0.5, max: 2, step: 0.01, show: vis },
    { k: s + '.lift', label: 'Lift', type: 'range', min: -1, max: 1, step: 0.01, show: vis },
    { k: s + '.spin', label: 'Turn', type: 'range', min: -180, max: 180, step: 5, int: true, show: vis },
    { k: s + '.tint', label: 'Change color', type: 'check', show: (o: any) => vis(o) && notModel(o) },
    { k: s + '.color', label: 'Color', type: 'color', show: (o: any) => vis(o) && o[s].tint && notModel(o) }
  ];
};
const eventDefs = (me: any, data: any): FieldDef[] => [
  { h: 'Hover state' },
  { k: 'hover.on', label: 'React when hovered', type: 'check' },
  ...stateLook('hover'),
  { h: 'Active state' },
  { note: 'How this object looks when a click or the scroll switches it on.' },
  ...stateLook('click'),
  { h: 'Click' },
  { k: 'click.on', label: 'Clickable', type: 'check' },
  { k: 'click.action', label: 'On click', type: 'select', options: [['toggle', 'Switch an active state'], ['link', 'Open a link'], ['camera', 'Move the camera'], ['var', 'Change a variable'], ['hook', 'Send a webhook']], show: (o: any) => o.click.on },
  { k: 'click.cam', label: 'Goes to', type: 'select', show: (o: any) => o.click.on && o.click.action === 'camera',
    options: [['', data.cameras.length ? 'Pick a camera' : 'Save a camera in the Scene tab first']].concat(data.cameras.map((c: any) => [c.id, c.name])) },
  { k: 'click.target', label: 'Switches', type: 'select', show: (o: any) => o.click.on && o.click.action === 'toggle',
    options: [['', 'This object']].concat(data.objects.filter((x: any) => x.id !== me.id).map((x: any) => [x.id, x.name || (NAMES as Record<string, string>)[x.type]])) },
  { k: 'click.url', label: 'Link', type: 'text', ph: 'https://', show: (o: any) => o.click.on && o.click.action === 'link' },
  { k: 'click.url', label: 'Sends to', type: 'text', ph: 'https://', show: (o: any) => o.click.on && o.click.action === 'hook' },
  { note: 'On the live page, a tap posts this object\'s name and the variables to that address.', show: (o: any) => o.click.on && o.click.action === 'hook' },
  { k: 'click.var', label: 'Variable', type: 'select', show: (o: any) => o.click.on && o.click.action === 'var',
    options: [['', data.vars.length ? 'Pick a variable' : 'Add a variable in the Scene tab first']].concat(data.vars.map((v: any) => [v.name, v.name])) },
  { k: 'click.op', label: 'Does', type: 'select', options: [['add', 'Add to it'], ['set', 'Set it to'], ['toggle', 'Flip it on or off']], show: (o: any) => o.click.on && o.click.action === 'var' },
  { k: 'click.val', label: 'Amount', type: 'text', show: (o: any) => o.click.on && o.click.action === 'var' && o.click.op !== 'toggle' },
  { h: 'Scroll' },
  { k: 'scroll.on', label: 'Move as the page scrolls', type: 'check' },
  { k: 'scroll.start', label: 'Starts at', type: 'range', min: 0, max: 1, step: 0.01, show: (o: any) => o.scroll.on },
  { k: 'scroll.end', label: 'Ends at', type: 'range', min: 0, max: 1, step: 0.01, show: (o: any) => o.scroll.on },
  { k: 'scroll.move', label: 'Move by', type: 'vec3', step: 0.1, show: (o: any) => o.scroll.on },
  { k: 'scroll.spin', label: 'Turn', type: 'range', min: -360, max: 360, step: 5, int: true, show: (o: any) => o.scroll.on },
  { k: 'scroll.scale', label: 'Size', type: 'range', min: 0.2, max: 3, step: 0.01, show: (o: any) => o.scroll.on },
  { k: 'scroll.activate', label: 'Switch to the active state at the end', type: 'check', show: (o: any) => o.scroll.on }
];
export const objectDefs = (me: any, data: any): FieldDef[] => [
  { h: 'Object' },
  { k: 'name', label: 'Name', type: 'text', max: 30 },
  { k: 'group', label: 'Group', type: 'text', max: 30, ph: 'None' },
  { k: 'text', label: 'Text', type: 'text', max: 28, show: (o: any) => o.type === 'text' || o.type === 'text3d' },
  { k: 'font', label: 'Typeface', type: 'select', show: (o: any) => o.type === 'text3d',
    options: [['righteous', 'Righteous (rounded)'], ['anton', 'Anton (tall, bold)'], ['inter', 'Inter (clean)'], ['playfair', 'Playfair (serif)'], ['spacemono', 'Space Mono (typewriter)'], ['pacifico', 'Pacifico (script)']] },
  { k: 'depth', label: 'Depth', type: 'range', min: 0.02, max: 1.5, step: 0.01, def: 0.25, show: (o: any) => o.type === 'text3d' || o.type === 'shape' },
  { k: 'smooth', label: 'Round the corners into curves', type: 'check', show: (o: any) => o.type === 'shape' },
  { k: 'showIf', label: 'Shown when', type: 'select', show: () => data.vars.length > 0, options: [['', 'Always']].concat(data.vars.map((v: any) => [v.name, v.name + ' is on or above zero'])) },
  { k: 'bevel', label: 'Bevel', type: 'range', min: 0, max: 0.12, step: 0.005, def: 0.03, show: (o: any) => o.type === 'text3d' },
  { k: 'to', label: 'Reaches to', type: 'vec3', step: 0.1, show: (o: any) => o.type === 'cord' },
  { k: 'slack', label: 'Slack', type: 'range', min: 0, max: 1.5, step: 0.01, def: 0.4, show: (o: any) => o.type === 'cord' },
  { k: 'thick', label: 'Thickness', type: 'range', min: 0.005, max: 0.1, step: 0.001, def: 0.02, show: (o: any) => o.type === 'cord' },
  { k: 'count', label: 'Count', type: 'range', min: 20, max: 1000, step: 10, int: true, def: 200, show: (o: any) => o.type === 'particles' },
  { k: 'spread', label: 'Spread', type: 'range', min: 0.5, max: 8, step: 0.1, def: 3, show: (o: any) => o.type === 'particles' },
  { k: 'psize', label: 'Dot size', type: 'range', min: 0.01, max: 0.25, step: 0.005, def: 0.06, show: (o: any) => o.type === 'particles' },
  { k: 'speed', label: 'Drift', type: 'range', min: 0, max: 2, step: 0.05, def: 0.4, show: (o: any) => o.type === 'particles' },
  { k: 'power', label: 'Brightness', type: 'range', min: 0, max: 40, step: 0.5, def: 8, show: (o: any) => o.type === 'light' },
  { k: 'reach', label: 'Reach', type: 'range', min: 0, max: 30, step: 0.5, def: 8, show: (o: any) => o.type === 'light' },
  { note: 'A light shines on nearby objects. Its marker only shows while editing.', show: (o: any) => o.type === 'light' },
  { h: 'Transform' },
  { k: 'pos', label: 'Position', type: 'vec3', step: 0.1 },
  { k: 'rot', label: 'Rotation', type: 'vec3', step: 5 },
  { k: 'scale', label: 'Size', type: 'uscale', min: 0.1, max: 4, step: 0.05 },
  { h: 'Material', show: shines },
  { h: 'Light color', show: (o: any) => o.type === 'light' },
  { k: 'mat.color', label: 'Color', type: 'color', show: notModel },
  { k: 'mat.roughness', label: 'Roughness', type: 'range', min: 0, max: 1, step: 0.01, show: solid },
  { k: 'mat.metalness', label: 'Metal', type: 'range', min: 0, max: 1, step: 0.01, show: solid },
  { k: 'mat.surface', label: 'Surface', type: 'select', options: [['none', 'Smooth'], ['brick', 'Brick'], ['plaster', 'Plaster'], ['ribbed', 'Ribbed']], show: shaped },
  { k: 'mat.texScale', label: 'Texture size', type: 'range', min: 0.1, max: 3, step: 0.05, def: 1, show: (o: any) => shaped(o) && o.mat.surface && o.mat.surface !== 'none' },
  { k: 'mat.style', label: 'Shading', type: 'select', options: [['standard', 'Realistic'], ['toon', 'Cartoon']], show: shaped },
  { k: 'mat.outline', label: 'Outline', type: 'range', min: 0, max: 1, step: 0.01, def: 0, show: shaped },
  { k: 'mat.line', label: 'Outline color', type: 'color', show: (o: any) => shaped(o) && o.mat.outline > 0 },
  { k: 'mat.glow', label: 'Glow', type: 'range', min: 0, max: 3, step: 0.05, show: shines },
  { k: 'mat.opacity', label: 'Opacity', type: 'range', min: 0.05, max: 1, step: 0.01, show: shines },
  { k: 'mat.glass', label: 'Glass', type: 'range', min: 0, max: 1, step: 0.01, show: shaped },
  { k: 'mat.bend', label: 'Bends light', type: 'range', min: 0, max: 3, step: 0.05, def: 1, show: (o: any) => shaped(o) && o.mat.glass > 0 },
  { k: 'mat.rainbow', label: 'Rainbow sheen', type: 'range', min: 0, max: 1, step: 0.01, def: 0, show: shaped },
  { h: 'Motion' },
  { k: 'anim.kind', label: 'Loop', type: 'select', options: [['none', 'None'], ['float', 'Float'], ['spin', 'Spin'], ['wobble', 'Wobble'], ['pulse', 'Pulse'], ['flicker', 'Flicker on (glow)']] },
  { k: 'anim.speed', label: 'Speed', type: 'range', min: 0.1, max: 3, step: 0.05, show: (o: any) => o.anim.kind !== 'none' },
  { k: 'anim.amount', label: 'Amount', type: 'range', min: 0, max: 2, step: 0.05, show: (o: any) => o.anim.kind !== 'none' },
  { k: 'follow', label: 'Follow cursor', type: 'range', min: 0, max: 1, step: 0.05 },
  { h: 'Copies', show: shaped },
  { k: 'clone.kind', label: 'Repeat', type: 'select', options: [['none', 'Just one'], ['grid', 'In a grid'], ['ring', 'Around a ring']], show: shaped },
  { k: 'clone.nx', label: 'Across', type: 'range', min: 1, max: 12, step: 1, int: true, show: (o: any) => shaped(o) && o.clone.kind === 'grid' },
  { k: 'clone.ny', label: 'Up', type: 'range', min: 1, max: 12, step: 1, int: true, show: (o: any) => shaped(o) && o.clone.kind === 'grid' },
  { k: 'clone.nz', label: 'Deep', type: 'range', min: 1, max: 12, step: 1, int: true, show: (o: any) => shaped(o) && o.clone.kind === 'grid' },
  { k: 'clone.gap', label: 'Spacing', type: 'range', min: 0.2, max: 6, step: 0.05, show: (o: any) => shaped(o) && o.clone.kind === 'grid' },
  { k: 'clone.count', label: 'How many', type: 'range', min: 2, max: 60, step: 1, int: true, show: (o: any) => shaped(o) && o.clone.kind === 'ring' },
  { k: 'clone.radius', label: 'Ring size', type: 'range', min: 0.3, max: 12, step: 0.1, show: (o: any) => shaped(o) && o.clone.kind === 'ring' },
  { h: 'Controls', show: canCollide },
  { k: 'control', label: 'Player moves it', type: 'select', options: [['none', 'No'], ['walk', 'Arrow keys, WASD or the touch pad']], show: canCollide },
  { k: 'speed', label: 'Speed', type: 'range', min: 0.5, max: 10, step: 0.1, def: 3, show: (o: any) => canCollide(o) && o.control === 'walk' },
  { note: 'Runs in Play. With physics set to Falls and collides, Space jumps.', show: (o: any) => canCollide(o) && o.control === 'walk' },
  { h: 'Physics', show: canCollide },
  { k: 'body', label: 'In Play', type: 'select', options: [['none', 'Stays where it is'], ['falls', 'Falls and collides'], ['solid', 'Solid, things land on it']], show: canCollide },
  { k: 'bounce', label: 'Bounce', type: 'range', min: 0, max: 1, step: 0.05, def: 0.3, show: (o: any) => canCollide(o) && o.body !== 'none' },
  { k: 'weight', label: 'Weight', type: 'range', min: 0.1, max: 10, step: 0.1, def: 1, show: (o: any) => canCollide(o) && o.body === 'falls' },
  { note: 'Falling objects land on the floor and on solid objects. Tap one in Play to give it a shove.', show: (o: any) => canCollide(o) && o.body !== 'none' },
  ...eventDefs(me, data),
];
export const sectionDefs: FieldDef[] = [
  { k: 'heading', label: 'Heading', type: 'text', max: 80 },
  { k: 'body', label: 'Text', type: 'text', max: 240 },
  { k: 'cta', label: 'Button', type: 'text', max: 30, ph: 'Leave empty for none' },
  { k: 'url', label: 'Button link', type: 'text', ph: 'https://' },
  { k: 'align', label: 'Side', type: 'select', options: [['left', 'Left'], ['center', 'Center'], ['right', 'Right']] },
  { k: 'vertical', label: 'Height', type: 'select', options: [['top', 'Top'], ['middle', 'Middle'], ['bottom', 'Bottom']] },
  { k: 'start', label: 'Shows from', type: 'range', min: 0, max: 1, step: 0.01 },
  { k: 'end', label: 'Shows until', type: 'range', min: 0, max: 1, step: 0.01 }
];
export const sceneDefs: FieldDef[] = [
  { h: 'Look' },
  { k: 'bg', label: 'Background', type: 'color' },
  { k: 'env', label: 'Soft light', type: 'range', min: 0, max: 2, step: 0.05 },
  { k: 'key', label: 'Key light', type: 'range', min: 0, max: 5, step: 0.1 },
  { k: 'keyAngle', label: 'Light angle', type: 'range', min: -180, max: 180, step: 5, int: true },
  { k: 'shadow', label: 'Shadow', type: 'range', min: 0, max: 0.8, step: 0.01 },
  { k: 'bloom', label: 'Bloom', type: 'range', min: 0, max: 2, step: 0.05, def: 0 },
  { k: 'ao', label: 'Ambient shadows', type: 'range', min: 0, max: 1, step: 0.05, def: 0 },
  { h: 'Sky' },
  { k: 'sky.on', label: 'Show a sky', type: 'check' },
  { k: 'sky.top', label: 'Overhead', type: 'color', show: (d: any) => d.sky.on },
  { k: 'sky.bottom', label: 'Horizon', type: 'color', show: (d: any) => d.sky.on },
  { h: 'Fog' },
  { k: 'fog.on', label: 'Fade distant objects into fog', type: 'check' },
  { k: 'fog.color', label: 'Fog color', type: 'color', show: (d: any) => d.fog.on },
  { k: 'fog.near', label: 'Starts at', type: 'range', min: 0, max: 40, step: 0.5, show: (d: any) => d.fog.on },
  { k: 'fog.far', label: 'Solid by', type: 'range', min: 2, max: 80, step: 0.5, show: (d: any) => d.fog.on },
  { h: 'Color' },
  { k: 'grade.exposure', label: 'Exposure', type: 'range', min: 0.3, max: 2.5, step: 0.05 },
  { k: 'grade.contrast', label: 'Contrast', type: 'range', min: 0.5, max: 1.6, step: 0.01 },
  { k: 'grade.saturation', label: 'Saturation', type: 'range', min: 0, max: 2, step: 0.01 },
  { k: 'grade.vignette', label: 'Vignette', type: 'range', min: 0, max: 1, step: 0.01 },
  { k: 'grade.tint', label: 'Tint', type: 'color' },
  { h: 'Camera' },
  { k: 'fov', label: 'Lens', type: 'range', min: 20, max: 75, step: 1, int: true },
  { k: 'drift', label: 'Cursor drift', type: 'range', min: 0, max: 1, step: 0.05 },
  { k: 'phoneZoom', label: 'Phone zoom', type: 'range', min: 0.5, max: 1, step: 0.01, def: 1 },
  { k: 'orbit', label: 'Visitors can drag to orbit', type: 'check' },
  { h: 'Scroll' },
  { k: 'scrollCam.on', label: 'Camera moves as the page scrolls', type: 'check' },
  { k: 'scrollCam.orbit', label: 'Orbit', type: 'range', min: -180, max: 180, step: 5, int: true, show: (d: any) => d.scrollCam.on },
  { k: 'scrollCam.zoom', label: 'Distance', type: 'range', min: 0.4, max: 2.5, step: 0.01, show: (d: any) => d.scrollCam.on },
  { k: 'scrollCam.rise', label: 'Rise', type: 'range', min: -3, max: 3, step: 0.05, show: (d: any) => d.scrollCam.on },
  { k: 'scrollLen', label: 'Scroll length', type: 'range', min: 1.5, max: 6, step: 0.5 },
  { h: 'Physics' },
  { k: 'gravity', label: 'Gravity', type: 'range', min: 0, max: 25, step: 0.1, def: 9.8 }
];

export const timelineDefs: FieldDef[] = [
  { h: 'Timeline' },
  { k: 'timeline.duration', label: 'Length (s)', type: 'range', min: 1, max: 20, step: 0.5 },
  { k: 'timeline.mode', label: 'Playback', type: 'select', options: [['loop', 'Loop'], ['pingpong', 'Back and forth'], ['once', 'Play once']] },
  { k: 'timeline.trigger', label: 'Runs on', type: 'select', options: [['load', 'Page load'], ['scroll', 'Page scroll']] }
];
