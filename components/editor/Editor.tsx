'use client';
import { useState } from 'react';
import { EditorStore, type EditorOptions } from '../../lib/editor/store';
import { Panel } from './Panel';
import { Viewport } from './Viewport';

// The whole editor for one scene. All state lives in an EditorStore created once per scene.
export function Editor(props: EditorOptions) {
  const [store] = useState(() => new EditorStore(props));
  return (
    <div className="layout">
      <Viewport store={store} />
      <Panel store={store} />
    </div>
  );
}
