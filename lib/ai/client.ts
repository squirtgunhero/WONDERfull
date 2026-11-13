// The browser side of building from a description: sends the request with the signed-in
// account's session and returns the scene, or throws an Error whose message can be shown as is.
import { supabase } from '../cloud';

export type Built = { scene: any; name: string; summary: string; used?: number; limit?: number };

export async function describeScene(prompt: string, scene?: any, selected?: string | null): Promise<Built> {
  const { data } = await supabase().auth.getSession();
  if (!data.session) throw new Error('Sign in to build from a description. You can do that from All scenes.');
  let res: Response;
  try {
    res = await fetch('/api/build', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + data.session.access_token },
      body: JSON.stringify({ prompt, scene, selected: selected || undefined }),
    });
  } catch (e) {
    throw new Error('The request did not get through. Check your connection and try again.');
  }
  const body = await res.json().catch(() => null);
  if (!res.ok || !body || !body.scene) throw new Error((body && body.message) || 'That did not work. Try again.');
  return body as Built;
}
