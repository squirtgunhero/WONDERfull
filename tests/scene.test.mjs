import test from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES, mk, normalize, objectSig, putKey, starter } from '../lib/scene.js';

test('mk gives every object the full set of fields', () => {
  const o = mk('sphere', { name: 'Ball', mat: { color: '#000000' }, hover: { on: true } });
  assert.equal(o.name, 'Ball');
  assert.equal(o.mat.color, '#000000');
  assert.equal(o.mat.roughness, 0.4, 'unspecified material values keep their defaults');
  assert.equal(o.hover.on, true);
  assert.equal(o.hover.scale, 1.1);
  assert.deepEqual(o.scroll.move, [0, 0, 0]);
  assert.deepEqual(o.keys, []);
});

test('every template is a complete scene with unique object ids', () => {
  for (const [label, make] of TEMPLATES) {
    const scene = make();
    normalize(scene);
    assert.ok(scene.camera.pos.length === 3 && scene.camera.target.length === 3, label + ' has a camera');
    assert.ok(Array.isArray(scene.sections), label + ' has sections');
    assert.ok(scene.page.color && scene.page.accent, label + ' has page colors');
    const ids = scene.objects.map((o) => o.id);
    assert.equal(new Set(ids).size, ids.length, label + ' ids are unique');
    for (const o of scene.objects) assert.ok(o.pos && o.rot && o.scale && o.mat && o.hover && o.click && o.scroll, label + ': ' + o.name);
  }
});

test('normalize repairs an old scene and picks readable page text', () => {
  const old = { bg: '#ffffff', camera: { pos: [0, 1, 5], target: [0, 0, 0] }, objects: [{ id: 'a', type: 'box', pos: [0, 0, 0], rot: [0, 0, 0], scale: [1, 1, 1] }] };
  normalize(old);
  assert.equal(old.page.color, '#14261c', 'dark text on a light background');
  assert.equal(old.timeline.duration, 4);
  assert.equal(old.objects[0].click.action, 'toggle');
  const dark = { bg: '#101010', camera: old.camera, objects: [] };
  normalize(dark);
  assert.equal(dark.page.color, '#f1ede2', 'light text on a dark background');
});

test('normalize is safe to run twice', () => {
  const scene = starter();
  normalize(scene);
  const once = JSON.stringify(scene);
  normalize(scene);
  assert.equal(JSON.stringify(scene), once);
});

test('objectSig changes only when the shape must be rebuilt', () => {
  const o = mk('text3d', { text: 'Hi', depth: 0.2 });
  const before = objectSig(o);
  o.pos = [1, 2, 3]; o.mat.color = '#123456';
  assert.equal(objectSig(o), before, 'moving and recoloring do not rebuild');
  o.text = 'Hello';
  assert.notEqual(objectSig(o), before, 'changing the text does');
});

test('putKey keeps keys in time order and replaces a key at the same time', () => {
  const keys = [];
  putKey(keys, { t: 2, pos: [2] });
  putKey(keys, { t: 0, pos: [0] });
  putKey(keys, { t: 2.01, pos: [9] });
  assert.deepEqual(keys.map((k) => k.t), [0, 2.01]);
  assert.deepEqual(keys[1].pos, [9]);
});
