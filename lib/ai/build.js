// The steps behind "build a scene from a description", kept apart from the web route so they can
// be tested without a network: check the request, check who is asking and how much they have used,
// ask the model, then clean what comes back.
import { SYSTEM, TOOL, userMessage } from './prompt.js';
import { compactScene, sanitizeScene } from './sanitize.js';

export const MAX_PROMPT = 2000;
const MAX_SCENE_BYTES = 300000;
const fail = (status, error, message) => ({ status, json: { error, message } });
const text = (v, max) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');

// Sends one request to the Anthropic Messages API and returns the parsed reply.
export async function callModel({ key, model, messages, fetchImpl = fetch, timeoutMs = 280000 }) {
  const res = await fetchImpl('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model, max_tokens: 16000,
      system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
      tools: [TOOL],
      // These models reject a forced tool call, so the prompt asks for the tool and "auto" allows it.
      tool_choice: { type: 'auto', disable_parallel_tool_use: true },
      messages,
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

// Finds the scene in a model reply: the tool call if there is one, otherwise JSON written as text.
export function readReply(body) {
  const blocks = (body && Array.isArray(body.content) ? body.content : []);
  const call = blocks.find((b) => b && b.type === 'tool_use' && b.name === TOOL.name && b.input && typeof b.input === 'object');
  if (call) return call.input;
  const said = blocks.filter((b) => b && b.type === 'text').map((b) => b.text).join('\n');
  const a = said.indexOf('{'), z = said.lastIndexOf('}');
  if (a >= 0 && z > a) {
    try {
      const parsed = JSON.parse(said.slice(a, z + 1));
      if (parsed && typeof parsed === 'object') return parsed.scene ? parsed : { scene: parsed };
    } catch (e) { /* not JSON */ }
  }
  return null;
}

// body: { prompt, scene?, selected? }
// deps: { key, model, user(): id or null, quota(): { allowed, used, limit }, ask(messages): { status, body }, log? }
export async function runBuild(body, deps) {
  const log = deps.log || (() => {});
  const prompt = body && typeof body.prompt === 'string' ? body.prompt.trim() : '';
  if (prompt.length < 3) return fail(400, 'empty', 'Describe what you want in a few words.');
  if (prompt.length > MAX_PROMPT) return fail(400, 'too_long', 'That description is too long. Keep it under ' + MAX_PROMPT + ' characters.');
  let current = null;
  if (body.scene != null) {
    if (typeof body.scene !== 'object' || !Array.isArray(body.scene.objects)) return fail(400, 'bad_scene', 'The current scene could not be read.');
    if (JSON.stringify(body.scene).length > MAX_SCENE_BYTES) return fail(400, 'scene_too_big', 'This scene is too large to change by description.');
    current = body.scene;
  }

  if (!(await deps.user())) return fail(401, 'signed_out', 'Sign in to build from a description.');
  if (!deps.key) return fail(503, 'not_configured', 'Building from a description is not switched on for this site yet.');
  let quota;
  try { quota = await deps.quota(); } catch (e) { log('quota check failed', e); quota = null; }
  if (!quota) return fail(503, 'no_quota', 'The daily limit could not be checked, so nothing was built. Try again in a moment.');
  if (!quota.allowed) return fail(429, 'limit', 'Today\'s limit of ' + quota.limit + ' builds is used up. It resets at midnight UTC.');

  const selected = current && typeof body.selected === 'string' && current.objects.some((o) => o && o.id === body.selected) ? body.selected : '';
  const messages = [{ role: 'user', content: userMessage(prompt, current && compactScene(current), selected) }];
  let reply;
  try { reply = await deps.ask(messages); } catch (e) {
    log('model request failed', e);
    return fail(504, 'timeout', 'The build took too long or the connection dropped. Try again, or ask for something smaller.');
  }
  if (reply.status !== 200) {
    log('model error', reply.status, reply.body && reply.body.error);
    if (reply.status === 401 || reply.status === 403) return fail(503, 'bad_key', 'The Anthropic key for this site was rejected. The site owner needs to check it.');
    if (reply.status === 429 || reply.status === 529) return fail(503, 'busy', 'The model is busy right now. Try again in a minute.');
    return fail(502, 'model_error', 'The model could not build that. Try again.');
  }
  const out = readReply(reply.body);
  let scene = null;
  if (out) { try { scene = sanitizeScene(out.scene, current); } catch (e) { scene = null; } }
  if (!scene) {
    log('no scene in reply', reply.body && reply.body.stop_reason);
    if (reply.body && reply.body.stop_reason === 'max_tokens') return fail(502, 'too_big', 'That scene came out too large to finish. Ask for something simpler.');
    if (reply.body && reply.body.stop_reason === 'refusal') return fail(422, 'declined', 'The model declined that request. Try describing it differently.');
    return fail(502, 'no_scene', 'The model did not return a scene. Try wording it differently.');
  }
  if (!scene.objects.length && !(current && current.objects.length === 0)) return fail(502, 'empty_scene', 'The model returned an empty scene. Try wording it differently.');
  return {
    status: 200,
    json: {
      scene,
      name: text(out.name, 60) || 'Untitled scene',
      summary: text(out.summary, 200) || (current ? 'Scene updated.' : 'Scene built.'),
      used: quota.used, limit: quota.limit,
    },
  };
}
