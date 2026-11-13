// POST /api/build turns a description into a scene, or changes the scene sent with it.
// It needs a signed-in account and the ANTHROPIC_API_KEY environment variable, and it counts
// each request against a daily limit kept in the database.
import { callModel, runBuild } from '../../../lib/ai/build';
import { SUPABASE_KEY, SUPABASE_URL } from '../../../lib/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const MODEL = process.env.WONDERFULL_AI_MODEL || 'claude-sonnet-5-5';

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const asUser = { apikey: SUPABASE_KEY, authorization: 'Bearer ' + token };

  const result = await runBuild(body, {
    key: process.env.ANTHROPIC_API_KEY || '',
    // Supabase confirms the session token belongs to a real account.
    user: async () => {
      if (!token) return null;
      const res = await fetch(SUPABASE_URL + '/auth/v1/user', { headers: asUser, cache: 'no-store' }).catch(() => null);
      const user = res && res.ok ? await res.json().catch(() => null) : null;
      return user && user.id ? user.id : null;
    },
    // The database counts this build and says whether the account is still under its daily limit.
    quota: async () => {
      const res = await fetch(SUPABASE_URL + '/rest/v1/rpc/use_ai_build', {
        method: 'POST', headers: { ...asUser, 'content-type': 'application/json' }, body: '{}', cache: 'no-store',
      });
      if (!res.ok) throw new Error('quota check returned ' + res.status);
      return res.json();
    },
    ask: (messages: unknown[]) => callModel({ key: process.env.ANTHROPIC_API_KEY || '', model: MODEL, messages }),
    log: (...args: unknown[]) => console.error('[build]', ...args),
  });
  return Response.json(result.json, { status: result.status, headers: { 'cache-control': 'no-store' } });
}
