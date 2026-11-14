// The standalone player. It is bundled into /wonderfull-runtime.js so a scene can run on any web
// page with one script tag:  WONDERfull.mount(element, sceneData)
import { createSceneRuntime, usesScroll } from './runtime.js';
import { normalize } from './scene.js';

export function mount(target, data, opts) {
  opts = opts || {};
  const el = typeof target === 'string' ? document.querySelector(target) : target;
  if (!el) throw new Error('WONDERfull.mount: the target element was not found');
  const scene = JSON.parse(JSON.stringify(data));
  normalize(scene);
  // A scene that reacts to scrolling gets a tall section with the picture pinned inside it.
  const scrolls = opts.scroll !== false && usesScroll(scene);
  const pin = document.createElement('div');
  pin.style.cssText = 'position:' + (scrolls ? 'sticky' : 'relative') + ';top:0;width:100%;height:' + (scrolls ? '100vh' : '100%') + ';overflow:hidden;';
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;';
  const overlay = document.createElement('div');
  pin.append(canvas, overlay);
  if (scrolls) { el.setAttribute('data-scroll-section', ''); el.style.height = (scene.scrollLen || 3) * 100 + 'vh'; }
  else if (!el.style.height && !el.clientHeight) el.style.height = '100vh';
  el.appendChild(pin);
  const runtime = createSceneRuntime(canvas, scene, { noFetch: true, overlay, buffers: opts.buffers });
  return { runtime, unmount() { runtime.dispose(); pin.remove(); } };
}
