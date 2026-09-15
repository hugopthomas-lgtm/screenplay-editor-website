// Screenplay Poster, in the pane: the scan the extension does, from typed paragraphs;
// the server draws the poster (/poster/generate through the Word gate).
import { call, getEmail } from './cloud.js';

const DEFAULT_STYLE = 'a24_minimal';
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// What the poster needs to know about the script (the extension's POSTER_SCAN, from styles).
export function scanForPoster(paras, fallbackTitle) {
  const chars = {}; const locs = {}; let cur = null; let scenes = 0; let lines = 0;
  const firstHead = paras.findIndex((p) => p.type === 'SCENE_HEADING');
  const preamble = firstHead > 0 ? paras.slice(0, firstHead) : [];
  const bodyParas = firstHead > 0 ? paras.slice(firstHead) : paras;
  const title = (preamble.find((p) => p.text.trim())?.text || fallbackTitle || 'Untitled').trim();
  for (const p of bodyParas) {
    const t = p.text.trim(); if (!t) continue;
    if (p.type === 'SCENE_HEADING') {
      scenes++; cur = null;
      let s = t.replace(/^\d+\.?\s+/, '').replace(/^(INT\/EXT\.?|EXT\/INT\.?|I\/E\.?|INT\.?|EXT\.?)\s+/i, '').replace(/\s+[-–—]\s+[^-–—]*$/, '').trim().toUpperCase();
      if (s) locs[s] = (locs[s] || 0) + 1;
    } else if (p.type === 'CHARACTER') {
      cur = t.replace(/\s*\(.*?\)\s*$/g, '').trim().toUpperCase();
      if (!chars[cur]) chars[cur] = { name: cur, lineCount: 0, wordCount: 0 };
    } else if (p.type === 'DIALOGUE' && cur && chars[cur]) {
      chars[cur].lineCount++; chars[cur].wordCount += t.split(/\s+/).filter(Boolean).length;
    }
    lines += Math.max(1, Math.ceil(t.length / (p.type === 'DIALOGUE' || p.type === 'CHARACTER' ? 33 : 58))) + (p.type === 'DIALOGUE' || p.type === 'PARENTHETICAL' ? 0 : 1);
  }
  const characters = Object.values(chars).filter((c) => c.lineCount > 0 && /[A-Za-zÀ-ÿ]/.test(c.name)).sort((a, b) => b.wordCount - a.wordCount).slice(0, 5).map((c) => ({ name: c.name, lineCount: c.lineCount }));
  const locations = Object.entries(locs).map(([name, count]) => ({ name, scenes: count, share: scenes ? Math.round(count / scenes * 100) : 0 })).sort((a, b) => b.scenes - a.scenes).slice(0, 8);
  const full = bodyParas.map((p) => p.text).join('\n');
  const CAP = 40000; let scriptText;
  if (full.length <= CAP) scriptText = full;
  else { const w = Math.floor(CAP / 3); const m = Math.floor((full.length - w) / 2); scriptText = '=== BEGINNING (first third) ===\n' + full.slice(0, w) + '\n\n=== MIDDLE (middle third, jumping over earlier text) ===\n' + full.slice(m, m + w) + '\n\n=== ENDING (final third, jumping over earlier text) ===\n' + full.slice(full.length - w); }
  return { title, hasTitlePage: preamble.length > 0, characters, locations, sceneCount: scenes, scriptText, pageCount: Math.max(1, Math.ceil(lines / 55)) };
}

export function renderPosterForm(el, scan) {
  el.innerHTML = `
    <div class="sv-card pg-plan">
      <div class="pg-kicker">Your film's poster</div>
      <div class="pg-desc">The AI reads ${scan.sceneCount} ${scan.sceneCount === 1 ? 'scene' : 'scenes'}, ${scan.characters.length} speaking ${scan.characters.length === 1 ? 'part' : 'parts'} and where the film mostly happens, then draws the poster a festival would print. About thirty seconds.</div>
      <label class="pf-lb pt-lb" for="pt-title">Title</label>
      <input class="se-input" id="pt-title" value="${esc(scan.title)}">
      <label class="pf-lb pt-lb" for="pt-logline">Logline <span class="sv-sub">optional</span></label>
      <textarea class="se-input pt-area" id="pt-logline" rows="2" maxlength="280" placeholder="One sentence on the engine of your film. Helps the poster find the right angle."></textarea>
      <label class="pf-lb pt-lb" for="pt-pitch">Pitch <span class="sv-sub">optional</span></label>
      <textarea class="se-input pt-area" id="pt-pitch" rows="3" maxlength="600" placeholder="A short paragraph on what the film is really about. It beats anything the AI would guess."></textarea>
      <button class="se-btn se-btn-dark pg-buy" data-se="poster-generate">Make the poster</button>
    </div>`;
}

export async function generatePoster(scan, fields) {
  const data = Object.assign({}, scan, { title: fields.title || scan.title, userLogline: fields.logline || '', userPitch: fields.pitch || '', style: DEFAULT_STYLE });
  return call('/poster/generate', data);
}

// A credit line at the foot for the free plan, like the extension.
export function watermark(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
        const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
        const fs = Math.max(11, Math.round(c.height / 95));
        ctx.font = '500 ' + fs + 'px Geist, Inter, "Helvetica Neue", Arial, sans-serif';
        if ('letterSpacing' in ctx) ctx.letterSpacing = '3px';
        ctx.fillStyle = 'rgba(255,255,255,0.78)'; ctx.textAlign = 'center'; ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 1;
        ctx.fillText('A SCRRRR.COM PRODUCTION', c.width / 2, c.height - Math.round(fs * 2));
        resolve(c.toDataURL('image/png'));
      } catch (_e) { resolve(dataUrl); }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export function renderPosterResult(el, out, imgUrl) {
  el.innerHTML = `
    <img class="pt-img" src="${imgUrl}" alt="Poster">
    ${out.genre ? `<div class="pg-kicker" style="margin-top:10px">${esc(out.genre)}</div>` : ''}
    ${out.tagline ? `<div class="pt-tagline">${esc(out.tagline)}</div>` : ''}
    <div class="se-titlepage-actions" style="margin-top:10px">
      <button class="se-btn" data-se="poster-again">Another one</button>
      <button class="se-btn se-btn-dark" data-se="poster-save">Save the poster</button>
    </div>
    <div class="sv-foot">${out.isPro ? 'Pro: up to twenty posters a month.' : (typeof out.remainingFree === 'number' ? `${out.remainingFree} free ${out.remainingFree === 1 ? 'poster' : 'posters'} left.` : '')}</div>`;
}
