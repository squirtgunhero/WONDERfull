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
  { k: 'click.action', label: 'On click', type: 'select', options: [['toggle', 'Switch an active state'], ['link', 'Open a link']], show: (o: any) => o.click.on },
  { k: 'click.target', label: 'Switches', type: 'select', show: (o: any) => o.click.on && o.click.action !== 'link',
    options: [['', 'This object']].concat(data.objects.filter((x: any) => x.id !== me.id).map((x: any) => [x.id, x.name || (NAMES as Record<string, string>)[x.type]])) },
  { k: 'click.url', label: 'Link', type: 'text', ph: 'https://', show: (o: any) => o.click.on && o.click.action === 'link' },
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
  { k: 'depth', label: 'Depth', type: 'range', min: 0.02, max: 1.5, step: 0.01, def: 0.25, show: (o: any) => o.type === 'text3d' },
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
  { k: 'mat.surface', label: 'Surface', type: 'select', options: [['none', 'Smooth'], ['brick', 'Brick'], ['plaster', 'Plaster'], ['ribbed', 'Ribbed']], show: (o: any) => solid(o) && o.type !== 'text' },
  { k: 'mat.texScale', label: 'Texture size', type: 'range', min: 0.1, max: 3, step: 0.05, def: 1, show: (o: any) => solid(o) && o.mat.surface && o.mat.surface !== 'none' },
  { k: 'mat.glow', label: 'Glow', type: 'range', min: 0, max: 3, step: 0.05, show: shines },
  { k: 'mat.opacity', label: 'Opacity', type: 'range', min: 0.05, max: 1, step: 0.01, show: shines },
  { k: 'mat.glass', label: 'Glass', type: 'range', min: 0, max: 1, step: 0.01, show: (o: any) => solid(o) && o.type !== 'text' },
  { h: 'Motion' },
  { k: 'anim.kind', label: 'Loop', type: 'select', options: [['none', 'None'], ['float', 'Float'], ['spin', 'Spin'], ['wobble', 'Wobble'], ['pulse', 'Pulse'], ['flicker', 'Flicker on (glow)']] },
  { k: 'anim.speed', label: 'Speed', type: 'range', min: 0.1, max: 3, step: 0.05, show: (o: any) => o.anim.kind !== 'none' },
  { k: 'anim.amount', label: 'Amount', type: 'range', min: 0, max: 2, step: 0.05, show: (o: any) => o.anim.kind !== 'none' },
  { k: 'follow', label: 'Follow cursor', type: 'range', min: 0, max: 1, step: 0.05 },
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
  { k: 'scrollLen', label: 'Scroll length', type: 'range', min: 1.5, max: 6, step: 0.5 }
];

export const timelineDefs: FieldDef[] = [
  { h: 'Timeline' },
  { k: 'timeline.duration', label: 'Length (s)', type: 'range', min: 1, max: 20, step: 0.5 },
  { k: 'timeline.mode', label: 'Playback', type: 'select', options: [['loop', 'Loop'], ['pingpong', 'Back and forth'], ['once', 'Play once']] },
  { k: 'timeline.trigger', label: 'Runs on', type: 'select', options: [['load', 'Page load'], ['scroll', 'Page scroll']] }
];
