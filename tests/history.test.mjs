import test from 'node:test';
import assert from 'node:assert/strict';
import { createHistory } from '../lib/editor/history.js';

test('undo and redo walk the snapshots in order', () => {
  const h = createHistory('a');
  assert.equal(h.canUndo(), false);
  assert.equal(h.commit('b'), true);
  assert.equal(h.commit('c'), true);
  assert.equal(h.undo(), 'b');
  assert.equal(h.undo(), 'a');
  assert.equal(h.undo(), null);
  assert.equal(h.redo(), 'b');
  assert.equal(h.redo(), 'c');
  assert.equal(h.redo(), null);
});

test('committing the same state is ignored', () => {
  const h = createHistory('a');
  assert.equal(h.commit('a'), false);
  assert.equal(h.canUndo(), false);
});

test('a new change after undo clears redo', () => {
  const h = createHistory('a');
  h.commit('b');
  h.undo();
  h.commit('c');
  assert.equal(h.canRedo(), false);
  assert.equal(h.undo(), 'a');
});

test('history is capped at its limit', () => {
  const h = createHistory('0', 3);
  for (let i = 1; i <= 10; i++) h.commit(String(i));
  let steps = 0;
  while (h.undo() !== null) steps++;
  assert.equal(steps, 3);
});
