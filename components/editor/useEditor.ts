import { useSyncExternalStore } from 'react';
import type { EditorStore } from '../../lib/editor/store';

// Redraws the calling component whenever the editor store changes.
export function useEditor(store: EditorStore): EditorStore {
  useSyncExternalStore(store.subscribe, store.getVersion, store.getVersion);
  return store;
}
