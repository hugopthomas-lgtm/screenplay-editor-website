// The paywall, the same as the extension's: a reverse trial of seven days from
// the first day seen, then Pro features ask for Pro. Identity is the e-mail.
import { call, getEmail } from './cloud.js';

export const PRICES = {
  monthly: { id: 'price_1TlpQFIo301M25CQdrblE8ls', big: '$7.99', per: 'month', alt: 'or $69 a year, normally $9.99' },
  yearly: { id: 'price_1TlpQZIo301M25CQq6NolBKB', big: '$69', per: 'year', alt: 'that is $5.75 a month' },
};
export const PRO_FEATURES = new Set(['Format document', 'Title Page', 'Scene Numbers', 'Final Draft export', 'Scene Board', 'Production Breakdown']);

let state = null; let fetchedAt = 0;
const noEmail = () => ({ needsTrialStart: true, isPro: false, paywallTriggered: false, isTrialing: false, daysRemaining: null });

// One ping a session (cached 30 s), the day is recorded server-side.
export async function refresh(force) {
  const email = getEmail();
  if (!email) { state = noEmail(); return state; }
  if (!force && state && Date.now() - fetchedAt < 30000) return state;
  try {
    const d = await call('/trial/ping', { dateISO: new Date().toISOString().slice(0, 10), source: 'word' });
    state = { needsTrialStart: false, isPro: !!d.isPro, paywallTriggered: !!d.paywallTriggered, isTrialing: !!d.isTrialing, daysRemaining: typeof d.daysRemaining === 'number' ? d.daysRemaining : null };
  } catch (_e) { state = state || { needsTrialStart: false, isPro: false, paywallTriggered: false, isTrialing: true, daysRemaining: null }; }
  fetchedAt = Date.now();
  return state;
}
export function current() { return state || noEmail(); }
export async function logFormat() { if (!getEmail()) return; try { await call('/trial/log-format', {}); } catch (_e) { /* quiet */ } }

// true = go ahead; false = the caller shows the gate (or the e-mail screen).
export async function allowed() {
  const s = await refresh(false);
  if (s.isPro) return 'ok';
  if (s.needsTrialStart) return 'email';
  if (!s.paywallTriggered) return 'ok';
  return 'pro';
}

export async function checkoutUrl(cycle) {
  const res = await fetch('https://screenplay-editor-api.hugopthomas.workers.dev/web/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: getEmail(), priceId: PRICES[cycle].id }) });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d.error || 'The checkout could not open.');
  return d.url || d.checkoutUrl || d.sessionUrl;
}
