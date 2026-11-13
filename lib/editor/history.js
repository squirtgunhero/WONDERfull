// Undo history: a list of scene snapshots (JSON strings) with a pointer to the current one.
export function createHistory(initial, limit = 60) {
  const past = [], future = [];
  let current = initial;
  return {
    // Records a new state. Returns true when it differed from the current one.
    commit(snap) {
      if (snap === current) return false;
      past.push(current);
      if (past.length > limit) past.shift();
      current = snap;
      future.length = 0;
      return true;
    },
    // Steps back and returns the state to show, or null when there is nothing to undo.
    undo() {
      if (!past.length) return null;
      future.push(current);
      current = past.pop();
      return current;
    },
    redo() {
      if (!future.length) return null;
      past.push(current);
      current = future.pop();
      return current;
    },
    canUndo: () => past.length > 0,
    canRedo: () => future.length > 0
  };
}
