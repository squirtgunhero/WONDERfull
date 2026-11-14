import test from 'node:test';
import assert from 'node:assert/strict';
import { neonSign, normalize, starter } from '../lib/scene.js';
import { compactScene, link, sanitizeScene } from '../lib/ai/sanitize.js';
import { readReply, runBuild } from '../lib/ai/build.js';

const toolReply = (input) => ({ status: 200, body: { stop_reason: 'tool_use', content: [{ type: 'text', text: 'Here you go.' }, { type: 'tool_use', name: 'build_scene', input }] } });
const deps = (over = {}) => ({ key: 'k', user: async () => 'u1', quota: async () => ({ allowed: true, used: 1, limit: 40 }), ask: async () => toolReply({ name: 'T', summary: 'S', scene: { objects: [{ id: 'a', type: 'box' }] } }), ...over });

test('sanitize clamps numbers, fixes colors and drops what it does not know', () => {
  const s = sanitizeScene({
    bg: '#ABC', fov: 500, env: -3, bloom: 'lots', evil: '<script>', camera: { pos: [1, 'x', 9999] },
    objects: [
      { id: 'lamp', type: 'sphere', pos: [0, 1, 0], scale: 2, mat: { color: 'red', glow: 99, surface: 'lava' }, anim: { kind: 'explode' }, onload: 'x' },
      { id: 'lamp', type: 'box', click: { on: true, target: 'lamp', action: 'link', url: 'javascript:alert(1)' } },
      { id: 'bad id!', type: 'text3d', text: 'x'.repeat(90), depth: 9 },
      { type: 'teapot' }, null, 'box',
      { id: 'm1', type: 'model', file: '../../secret.glb' },
    ],
  });
  assert.equal(s.bg, '#aabbcc');
  assert.equal(s.fov, 75);
  assert.equal(s.env, 0);
  assert.equal(s.bloom, 0);
  assert.equal(s.evil, undefined);
  assert.deepEqual(s.camera.pos, [1, 2.5, 80]);
  assert.equal(s.objects.length, 3, 'unknown types, junk and models with no source are dropped');
  const [lamp, box, word] = s.objects;
  assert.deepEqual(lamp.scale, [2, 2, 2]);
  assert.equal(lamp.mat.color, '#ff4f2e');
  assert.equal(lamp.mat.glow, 3);
  assert.equal(lamp.mat.surface, 'none');
  assert.equal(lamp.anim.kind, 'none');
  assert.equal(lamp.onload, undefined);
  assert.notEqual(box.id, 'lamp', 'a repeated id gets a new one');
  assert.equal(box.click.target, 'lamp');
  assert.equal(box.click.url, '');
  assert.equal(box.click.action, 'toggle', 'a link with no safe address falls back to a toggle');
  assert.match(word.id, /^[A-Za-z0-9_-]+$/);
  assert.equal(word.text.length, 28);
  assert.equal(word.depth, 1.5);
  assert.equal(new Set(s.objects.map((o) => o.id)).size, 3);
  normalize(s);
  assert.ok(s.page.color, 'the editor can load the result');
});

test('links may only be web, page, path or mail addresses', () => {
  assert.equal(link('https://example.com'), 'https://example.com');
  assert.equal(link('#top'), '#top');
  assert.equal(link('mailto:a@b.co'), 'mailto:a@b.co');
  assert.equal(link(' JavaScript:alert(1)'), '');
  assert.equal(link('data:text/html,x'), '');
  assert.equal(link(42), '');
});

test('an edit keeps imported models, untouched settings and page text', () => {
  const current = neonSign();
  normalize(current);
  current.objects.push({ ...current.objects[0], id: 'puppet', type: 'model', file: 'puppet.glb', name: 'Puppet' });
  const s = sanitizeScene({ bg: '#000022', objects: [{ id: 'puppet', type: 'model', file: 'other.glb', pos: [1, 0, 0] }, { id: 'new', type: 'model' }, { id: 'j1', type: 'text3d', text: 'Open' }] }, current);
  assert.equal(s.bg, '#000022');
  assert.equal(s.bloom, current.bloom, 'settings the model left out stay as they were');
  assert.equal(s.sections.length, 3);
  assert.equal(s.page.accent, current.page.accent);
  assert.deepEqual(s.objects.map((o) => o.id), ['puppet', 'j1']);
  assert.equal(s.objects[0].file, 'puppet.glb', 'the file always comes from the current scene');
  assert.deepEqual(s.objects[0].pos, [1, 0, 0]);
});

test('sections, keys and click targets are tidied', () => {
  const s = sanitizeScene({
    timeline: { duration: 5 },
    sections: [{ heading: 'Hi', start: 0.6, end: 0.2, url: 'ftp://x', align: 'diagonal' }, 'nope'],
    objects: [
      { id: 'a', type: 'box', click: { on: true, target: 'ghost' }, scroll: { on: true, start: 0.8, end: 0.1 },
        keys: [{ t: 9, pos: [0, 1, 0] }, { t: 0, pos: [0, 0, 0] }, { t: 0.01, pos: [5, 5, 5] }] },
      { id: 'b', type: 'box', click: { on: true, target: 'b' } },
    ],
  });
  assert.deepEqual(s.sections, [{ heading: 'Hi', body: '', cta: '', url: '', align: 'center', vertical: 'bottom', start: 0.6, end: 0.6 }]);
  const [a, b] = s.objects;
  assert.equal(a.click.target, '');
  assert.equal(b.click.target, '', 'targeting itself is the same as no target');
  assert.equal(a.scroll.end, 0.8);
  assert.deepEqual(a.keys.map((k) => k.t), [0, 5]);
  assert.deepEqual(a.keys[1].scale, [1, 1, 1]);
});

test('a reply that is not a scene is refused', () => {
  assert.throws(() => sanitizeScene({ name: 'x' }));
  assert.throws(() => sanitizeScene('hello'));
  assert.equal(sanitizeScene('{"objects":[]}').objects.length, 0);
});

test('the short form round-trips to the same scene', () => {
  for (const make of [starter, neonSign]) {
    const full = make();
    normalize(full);
    const compact = compactScene(full);
    assert.ok(JSON.stringify(compact).length < JSON.stringify(full).length * 0.6, 'the short form is much smaller');
    const back = sanitizeScene(compact, full);
    normalize(back);
    // The cleaner rounds to three places, so compare at that precision.
    const round = (v) => JSON.parse(JSON.stringify(v, (k, x) => (typeof x === 'number' ? Math.round(x * 1000) / 1000 : x)));
    assert.deepEqual(back.objects, round(full.objects));
    assert.deepEqual(back.sections, round(full.sections));
    assert.deepEqual(back.camera, round(full.camera));
  }
});

test('readReply finds a tool call, or JSON written as text', () => {
  assert.deepEqual(readReply(toolReply({ scene: { objects: [] } }).body), { scene: { objects: [] } });
  assert.deepEqual(readReply({ content: [{ type: 'text', text: 'Sure:\n```json\n{"objects":[]}\n```' }] }), { scene: { objects: [] } });
  assert.equal(readReply({ content: [{ type: 'text', text: 'I cannot.' }] }), null);
  assert.equal(readReply(null), null);
});

test('runBuild checks the request, the account, the key and the limit before asking the model', async () => {
  let asked = 0;
  const ask = async () => { asked++; return toolReply({ name: 'T', summary: 'S', scene: { objects: [{ id: 'a', type: 'box' }] } }); };
  assert.equal((await runBuild({ prompt: ' a ' }, deps({ ask }))).status, 400);
  assert.equal((await runBuild({ prompt: 'x'.repeat(2001) }, deps({ ask }))).status, 400);
  assert.equal((await runBuild({ prompt: 'a cat', scene: { objects: 'no' } }, deps({ ask }))).status, 400);
  assert.equal((await runBuild({ prompt: 'a cat' }, deps({ ask, user: async () => null }))).status, 401);
  assert.equal((await runBuild({ prompt: 'a cat' }, deps({ ask, key: '' }))).json.error, 'not_configured');
  assert.equal((await runBuild({ prompt: 'a cat' }, deps({ ask, quota: async () => ({ allowed: false, used: 40, limit: 40 }) }))).status, 429);
  assert.equal((await runBuild({ prompt: 'a cat' }, deps({ ask, quota: async () => { throw new Error('down'); } }))).json.error, 'no_quota');
  assert.equal(asked, 0, 'none of those reached the model');
  const ok = await runBuild({ prompt: 'a cat' }, deps({ ask }));
  assert.equal(ok.status, 200);
  assert.equal(ok.json.name, 'T');
  assert.equal(ok.json.scene.objects[0].type, 'box');
  assert.equal(asked, 1);
});

test('runBuild sends the current scene in short form and reports model trouble plainly', async () => {
  const current = starter();
  normalize(current);
  let sent = '';
  const ask = async (messages) => { sent = messages[0].content; return toolReply({ name: 'N', summary: 'Made the ball red.', scene: { objects: [{ id: 's2', type: 'sphere', mat: { color: '#ff0000' } }] } }); };
  const ok = await runBuild({ prompt: 'make this red', scene: current, selected: 's2' }, deps({ ask }));
  assert.match(sent, /Selected object id: s2/);
  assert.match(sent, /Change requested:\n\nmake this red/);
  assert.ok(!sent.includes('"metalness":0,'), 'default values are left out of what is sent');
  assert.equal(ok.json.scene.objects[0].mat.color, '#ff0000');
  assert.equal(ok.json.scene.fov, current.fov);

  const status = async (reply) => (await runBuild({ prompt: 'a cat' }, deps({ ask: async () => reply }))).json.error;
  assert.equal(await status({ status: 401, body: {} }), 'bad_key');
  assert.equal(await status({ status: 529, body: {} }), 'busy');
  assert.equal(await status({ status: 400, body: {} }), 'model_error');
  assert.equal(await status({ status: 200, body: { stop_reason: 'max_tokens', content: [] } }), 'too_big');
  assert.equal(await status({ status: 200, body: { stop_reason: 'end_turn', content: [{ type: 'text', text: 'No.' }] } }), 'no_scene');
  assert.equal(await status(toolReply({ scene: { objects: [] } })), 'empty_scene');
  assert.equal((await runBuild({ prompt: 'a cat' }, deps({ ask: async () => { throw new Error('aborted'); } }))).status, 504);
});

test('lights are kept within limits and earlier requests travel with an edit', async () => {
  const lights = Array.from({ length: 12 }, (_, i) => ({ id: 'l' + i, type: 'light', power: 999, reach: -4, mat: { color: '#ffaa00' } }));
  const s = sanitizeScene({ objects: [...lights, { id: 'd', type: 'dome' }, { id: 'h', type: 'heart' }] });
  assert.equal(s.objects.filter((o) => o.type === 'light').length, 8);
  assert.equal(s.objects[0].power, 40);
  assert.equal(s.objects[0].reach, 0);
  assert.deepEqual(s.objects.slice(-2).map((o) => o.type), ['dome', 'heart']);
  let sent = '';
  const ask = async (messages) => { sent = messages[0].content; return toolReply({ scene: { objects: [{ id: 'a', type: 'box' }] } }); };
  await runBuild({ prompt: 'warmer', scene: { objects: [{ id: 'a', type: 'box' }] }, earlier: ['add a lamp', 7, 'make it night'] }, deps({ ask }));
  assert.match(sent, /oldest first, already applied:\n- add a lamp\n- make it night\n/);
});

test('group names survive cleaning and the short form', () => {
  const s = sanitizeScene({ objects: [{ id: 't1', type: 'cylinder', group: '  Tree  ' }, { id: 't2', type: 'sphere', group: 'Tree' }, { id: 'f', type: 'box', group: 7 }] });
  assert.deepEqual(s.objects.map((o) => o.group), ['Tree', 'Tree', '']);
  const c = compactScene(s);
  assert.equal(c.objects[0].group, 'Tree');
  assert.equal('group' in c.objects[2], false);
});
