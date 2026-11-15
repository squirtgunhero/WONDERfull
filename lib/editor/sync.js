// Live editing between people: what changed in a scene since it was last shared, and how to fold someone
// else's changes in. Changes travel per object, so two people working on different objects never collide.
// When two people change the same object at once, the later change wins.
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// prev and next are whole scenes. Returns null when nothing changed.
export function diffScene(prev, next) {
  const patch = { objects: {}, scene: {} };
  let changed = false;
  const before = new Map((prev.objects || []).map((o) => [o.id, o]));
  (next.objects || []).forEach((o) => { if (!same(before.get(o.id), o)) { patch.objects[o.id] = o; changed = true; } before.delete(o.id); });
  before.forEach((o, id) => { patch.objects[id] = null; changed = true; });
  const order = (next.objects || []).map((o) => o.id);
  if (!same(order, (prev.objects || []).map((o) => o.id))) { patch.order = order; changed = true; }
  new Set([...Object.keys(prev), ...Object.keys(next)]).forEach((k) => {
    if (k !== 'objects' && !same(prev[k], next[k])) { patch.scene[k] = next[k] === undefined ? null : next[k]; changed = true; }
  });
  return changed ? JSON.parse(JSON.stringify(patch)) : null;
}

// Folds a patch into a scene in place. Objects whose ids are in "busy" are left alone (the person is dragging them).
export function applyPatch(data, patch, busy) {
  if (!patch || typeof patch !== 'object') return false;
  const skip = new Set(busy || []), objects = patch.objects && typeof patch.objects === 'object' ? patch.objects : {};
  Object.keys(objects).forEach((id) => {
    if (skip.has(id)) return;
    const at = data.objects.findIndex((o) => o.id === id), o = objects[id];
    if (o === null) { if (at >= 0) data.objects.splice(at, 1); }
    else if (o && typeof o === 'object' && o.id === id && typeof o.type === 'string') { if (at >= 0) data.objects[at] = o; else data.objects.push(o); }
  });
  if (Array.isArray(patch.order)) {
    const rank = new Map(patch.order.map((id, i) => [id, i]));
    data.objects.sort((a, b) => (rank.has(a.id) ? rank.get(a.id) : 1e9) - (rank.has(b.id) ? rank.get(b.id) : 1e9));
  }
  const scene = patch.scene && typeof patch.scene === 'object' ? patch.scene : {};
  Object.keys(scene).forEach((k) => { if (k === 'objects') return; if (scene[k] === null) delete data[k]; else data[k] = scene[k]; });
  return true;
}
