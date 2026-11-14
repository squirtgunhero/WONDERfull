'use client';
import { useEffect, useState } from 'react';
import { EditorStore, type EditorOptions } from '../../lib/editor/store';
import { Panel } from './Panel';
import { useEditor } from './useEditor';
import { Viewport } from './Viewport';

const WIDE = '(min-width: 1180px)';

// The whole editor for one scene. All state lives in an EditorStore created once per scene.
// Wide screens get three columns: describe and objects, the viewport, then properties.
// Narrower screens get the viewport and one panel that holds every tab.
export function Editor(props: EditorOptions) {
  const [store] = useState(() => {
    const st = new EditorStore(props);
    st.wide = typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(WIDE).matches;
    return st;
  });
  useEditor(store);
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia(WIDE), on = () => store.setWide(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [store]);
  return (
    <div className={'layout' + (store.wide ? ' three' : '')}>
      {store.wide && <Panel store={store} side="left" />}
      <Viewport store={store} />
      <Panel store={store} side={store.wide ? 'right' : 'all'} />
    </div>
  );
}
