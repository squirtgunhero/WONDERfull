'use client';
import { useEffect, useRef } from 'react';
import type { EditorStore, Gizmo } from '../../lib/editor/store';
import { useEditor } from './useEditor';

const GIZMOS: [Gizmo, string][] = [['translate', 'Move'], ['rotate', 'Turn'], ['scale', 'Size']];

// The 3D view with its on-canvas controls: mode, gizmo, undo and redo, and the scroll preview.
export function Viewport({ store }: { store: EditorStore }) {
  useEditor(store);
  const canvas = useRef<HTMLCanvasElement>(null);
  const overlay = useRef<HTMLDivElement>(null);
  useEffect(() => store.mount(canvas.current!, overlay.current!), [store]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z') return;
      const tag = (document.activeElement && document.activeElement.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      e.preventDefault();
      if (e.shiftKey) store.redo(); else store.undo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [store]);

  const edit = store.mode === 'edit';
  return (
    <div className="stage" id="stage">
      <canvas id="scene" ref={canvas} aria-label="3D scene viewport" />
      <div id="pageOverlay" ref={overlay} />
      {store.webglFailed && <div className="nogl" style={{ display: 'flex' }}>This browser could not start WebGL, so the scene cannot draw here.</div>}
      <div className="seg left" role="group" aria-label="Mode">
        <button type="button" id="m-edit" aria-pressed={edit} onClick={() => store.setMode('edit')}>Edit</button>
        <button type="button" id="m-play" aria-pressed={!edit} onClick={() => store.setMode('play')}>Play</button>
      </div>
      {edit ? (
        <>
          <div className="seg right" id="gizmoSeg" role="group" aria-label="Gizmo">
            {GIZMOS.map(([g, label]) => (
              <button key={g} type="button" data-giz={g} aria-pressed={store.gizmo === g} onClick={() => store.setGizmo(g)}>{label}</button>
            ))}
          </div>
          <div className="seg br" id="histSeg" role="group" aria-label="History">
            <button type="button" id="undo" disabled={!store.canUndo} onClick={() => store.undo()}>Undo</button>
            <button type="button" id="redo" disabled={!store.canRedo} onClick={() => store.redo()}>Redo</button>
          </div>
        </>
      ) : (
        <label className="scrub" id="scrub" htmlFor="scrollPrev" style={{ display: 'flex' }}>
          Scroll
          <input type="range" id="scrollPrev" min={0} max={1} step={0.001} value={store.scroll} onChange={(e) => store.setScroll(Number(e.target.value))} />
        </label>
      )}
      <p className="hint" id="hint" role="status">{store.hint}</p>
    </div>
  );
}
