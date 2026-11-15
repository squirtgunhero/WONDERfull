// How editors of the same scene reach each other. A scene saved to an account uses a private live channel that
// only its owner and the people it is shared with can join. A scene kept in this browser syncs between tabs.
import { supabase } from '../cloud';

export type Peer = { key: string; name: string; color: string; selected: string | null };
export type Transport = {
  send(type: string, payload: unknown): void;
  on(cb: (type: string, payload: any) => void): void;
  presence(state: Omit<Peer, 'key'>): void;
  onPeers(cb: (peers: Peer[]) => void): void;
  close(): void;
};

const COLORS = ['#e5484d', '#f76b15', '#12a594', '#0090ff', '#8e4ec6', '#d6409f', '#46a758', '#ad7f00'];
export const colorFor = (key: string) => COLORS[Array.from(key).reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7) % COLORS.length];

export function localTransport(sceneId: string): Transport | null {
  if (typeof BroadcastChannel === 'undefined') return null;
  const me = Math.random().toString(36).slice(2, 10), ch = new BroadcastChannel('wonderfull-scene-' + sceneId);
  const seen = new Map<string, { peer: Peer; at: number }>();
  let onMsg: (type: string, payload: any) => void = () => {}, onPeers: (peers: Peer[]) => void = () => {}, state: Omit<Peer, 'key'> | null = null;
  const tell = () => onPeers(Array.from(seen.values()).map((s) => s.peer));
  ch.onmessage = (e) => {
    const m = e.data || {};
    if (m.from === me) return;
    if (m.type === '__here') { seen.set(m.from, { peer: { key: m.from, ...m.payload }, at: Date.now() }); tell(); }
    else if (m.type === '__bye') { seen.delete(m.from); tell(); }
    else onMsg(m.type, m.payload);
  };
  const beat = setInterval(() => {
    if (state) ch.postMessage({ from: me, type: '__here', payload: state });
    let dropped = false;
    seen.forEach((s, k) => { if (Date.now() - s.at > 5000) { seen.delete(k); dropped = true; } });
    if (dropped) tell();
  }, 1500);
  return {
    send: (type, payload) => ch.postMessage({ from: me, type, payload }),
    on: (cb) => { onMsg = cb; },
    presence: (s) => { state = s; ch.postMessage({ from: me, type: '__here', payload: s }); },
    onPeers: (cb) => { onPeers = cb; },
    close: () => { clearInterval(beat); ch.postMessage({ from: me, type: '__bye' }); ch.close(); },
  };
}

export async function cloudTransport(sceneId: string, userId: string): Promise<Transport | null> {
  try {
    const sb = supabase();
    await sb.realtime.setAuth();
    const key = userId + ':' + Math.random().toString(36).slice(2, 8);
    const ch = sb.channel('scene:' + sceneId, { config: { private: true, broadcast: { self: false }, presence: { key } } });
    let onMsg: (type: string, payload: any) => void = () => {}, onPeers: (peers: Peer[]) => void = () => {}, state: Omit<Peer, 'key'> | null = null, joined = false;
    ch.on('broadcast', { event: 'msg' }, (m: any) => { const p = m.payload || {}; onMsg(p.type, p.payload); });
    ch.on('presence', { event: 'sync' }, () => {
      const all = ch.presenceState() as Record<string, any[]>;
      onPeers(Object.keys(all).filter((k) => k !== key).map((k) => ({ key: k, name: String(all[k][0]?.name || 'Someone'), color: String(all[k][0]?.color || '#888'), selected: all[k][0]?.selected || null })));
    });
    ch.subscribe((status: string) => { if (status === 'SUBSCRIBED') { joined = true; if (state) ch.track(state); } });
    return {
      send: (type, payload) => { if (joined) ch.send({ type: 'broadcast', event: 'msg', payload: { type, payload } }); },
      on: (cb) => { onMsg = cb; },
      presence: (s) => { state = s; if (joined) ch.track(s); },
      onPeers: (cb) => { onPeers = cb; },
      close: () => { sb.removeChannel(ch); },
    };
  } catch (e) {
    return null;
  }
}
