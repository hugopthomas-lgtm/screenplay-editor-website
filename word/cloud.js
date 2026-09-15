// The server, through the Word gate: no key in the pane, the origin is the key.
// Identity is the e-mail the user gives in Preferences (licence, quotas, credits).
export const API = 'https://screenplay-editor-api.hugopthomas.workers.dev/word/api';

export function getEmail() { try { return (localStorage.getItem('se_word_email') || '').trim(); } catch (_e) { return ''; } }
export function setEmail(v) { try { localStorage.setItem('se_word_email', (v || '').trim()); } catch (_e) { /* private mode */ } }

export async function call(path, body) {
  const res = await fetch(API + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ email: getEmail() || undefined }, body || {})) });
  let data = null;
  try { data = await res.json(); } catch (_e) { /* no body */ }
  if (!res.ok) { const err = new Error((data && (data.error || data.message)) || `Server said ${res.status}.`); err.status = res.status; err.data = data; throw err; }
  return data;
}

// A GET through the gate, the e-mail in the query (credits balance).
export async function get(path, params) {
  const q = new URLSearchParams(Object.assign({ email: getEmail() }, params || {}));
  const res = await fetch(API + path + '?' + q.toString());
  let data = null;
  try { data = await res.json(); } catch (_e) { /* no body */ }
  if (!res.ok) { const err = new Error((data && (data.error || data.message)) || `Server said ${res.status}.`); err.status = res.status; err.data = data; throw err; }
  return data;
}

export function detectLanguage(text) {
  const fr = (text.match(/\b(le|la|les|un|une|des|du|de|et|est|que|qui|dans|pour|sur|avec|pas|son|ses|mais)\b/gi) || []).length;
  const en = (text.match(/\b(the|a|an|is|are|was|were|has|have|had|this|that|with|for|not|but|and|or)\b/gi) || []).length;
  return fr > en ? 'fr' : 'en';
}

// Scenes for the breakdown: heading + the text under it, 600 characters at most, like the extension.
export function scenesForBreakdown(paras) {
  const scenes = []; let cur = null;
  for (const p of paras) {
    if (p.type === 'SCENE_HEADING') { if (cur) scenes.push(cur); cur = { heading: p.text, body: '' }; continue; }
    if (cur) cur.body = (cur.body + ' ' + p.text).trim().slice(0, 600);
  }
  if (cur) scenes.push(cur);
  return scenes;
}
