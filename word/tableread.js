// Table Read in the pane: the script cut into cues, a voice per character,
// the server speaks one line at a time, the pane plays them one after the other.
// Same rules as the extension: title page skipped, names announced by the narrator
// once per scene, directions skipped unless asked, long speeches cut at 500 characters.
import { call, get, detectLanguage } from './cloud.js';

export const ENGINE = 'elevenlabs_fast';             // 10 credits per 10 000 characters
const RATE = 10 / 10000;
export const PACK = { id: '10', credits: 100, price: '$10' };
const NARRATOR_ID = 'JBFqnCBsd6RMkjVDRZzb';          // George, like the extension
const VOICES_KEY = 'se_word_voices';                 // { CHARACTER: voice_id } chosen by the user
// The thirteen voices of the extension, stable and distinct.
export const VOICES = [
  { voice_id: 'IKne3meq5aSn9XLyUdCD', name: 'Charlie', gender: 'male', age: 'young' },
  { voice_id: 'bIHbv24MWmeRgasZH58o', name: 'Will', gender: 'male', age: 'young' },
  { voice_id: 'nPczCjzI2devNBz1zQrb', name: 'Brian', gender: 'male', age: 'middle_aged' },
  { voice_id: 'cjVigY5qzO86Huf0OWal', name: 'Eric', gender: 'male', age: 'middle_aged' },
  { voice_id: 'iP95p4xoKVk53GoZ082l', name: 'Chris', gender: 'male', age: 'middle_aged' },
  { voice_id: 'pqHfZKP75CvOlQylNhV4', name: 'Bill', gender: 'male', age: 'old' },
  { voice_id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George', gender: 'male', age: 'middle_aged' },
  { voice_id: 'cgSgspJ2msm6clMCkdEp', name: 'Jessica', gender: 'female', age: 'young' },
  { voice_id: 'FGY2WhTYpPnrIDTdsKH5', name: 'Laura', gender: 'female', age: 'young' },
  { voice_id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah', gender: 'female', age: 'middle_aged' },
  { voice_id: 'pFZP5JQG7iQjIQuC4Bku', name: 'Lily', gender: 'female', age: 'middle_aged' },
  { voice_id: 'Xb7hH8MSUJpSbSDYk0k2', name: 'Alice', gender: 'female', age: 'middle_aged' },
  { voice_id: 'XrExE9yKIg1WjnnlVkGX', name: 'Matilda', gender: 'female', age: 'old' },
];
const AGE = { young: 'young', middle_aged: 'adult', old: 'senior' };
// First names, FR and EN, when the server has no opinion (the extension's lists). Also the words that give a gender away.
const FEMALE = new Set('adele,agathe,alice,ambre,amelie,ana,anais,andrea,angela,anna,anne,annie,audrey,aurore,axelle,beatrice,bella,blandine,brigitte,camille,capucine,carla,carmen,caroline,catherine,cecile,celine,charlotte,chloe,claire,clara,clemence,colette,cynthia,daphne,delphine,diana,diane,eleonore,elena,elisa,elise,elizabeth,ella,elodie,eloise,elsa,emily,emma,estelle,eugenie,eva,fabienne,fanny,fatima,faustine,flora,florence,floriane,francoise,gabrielle,giulia,grace,hana,hannah,helena,helene,hortense,ines,iris,isabelle,jade,jane,jasmine,jeanne,jennifer,jessica,jihane,joan,johanna,josephine,judith,julia,julie,juliette,justine,karen,karine,kate,kim,lana,lara,laura,laure,laurence,lea,leila,lena,leona,leonie,lili,lily,lina,linda,lisa,lise,lola,louise,lou,lucia,lucie,lucile,lucy,luna,lydia,madeleine,maelle,maelys,manon,marcia,margaret,margaux,margot,marguerite,maria,mariam,marie,marina,marion,marta,martha,martine,mary,mathilde,matilda,maud,maya,melanie,melissa,meryl,michelle,milena,mireille,mona,monica,monique,morgane,muriel,nadia,naomi,natacha,natalie,nathalie,nicole,nina,noemie,nora,oceane,olga,olivia,ophelie,pamela,patricia,paula,pauline,perrine,priscille,prune,rachel,raphaelle,rebecca,regina,rita,romane,rosa,rosalie,rose,roxane,ruth,sabine,sabrina,sally,salome,samira,sandra,sara,sarah,sasha,severine,simone,sofia,soline,solange,sonia,sophie,stella,stephanie,susan,suzanne,sylvie,sylviane,tania,tatiana,tessa,therese,ursula,valentina,valentine,valerie,vanessa,vera,veronica,victoria,virginie,vivien,viviane,wendy,yasmine,yvette,yvonne,zoe,mere,maman,mother,mom,mum,femme,wife,fille,girl,daughter,soeur,sister,tante,aunt,grand-mere,grandma,grandmother,vieille,dame,lady,madame,mrs,ms,miss,mademoiselle,reine,queen,princesse,princess,infirmiere,nurse,serveuse,waitress,voisine,neighbour'.split(','));
const MALE = new Set('adam,adrien,alain,albert,alex,alexandre,alfred,andre,andrew,anthony,antoine,antonio,armand,arnaud,arthur,axel,aymeric,baptiste,ben,benjamin,benoit,bernard,bill,bob,boris,brian,bruno,cameron,carl,charles,charlie,chris,christian,christophe,claude,clement,colin,corentin,cyril,damian,daniel,david,denis,dennis,didier,dominique,douglas,edouard,edward,elias,elie,emile,emmanuel,enzo,eric,ernest,ethan,etienne,evan,fabien,fabrice,felix,florent,francis,francois,frank,frederic,gabriel,gabin,gaspard,gaston,george,georges,gerald,gerard,gilbert,giles,greg,gregory,guillaume,gustave,guy,hadrien,hans,harold,harry,henri,henry,herbert,hugo,hugues,ian,isaac,ivan,jack,jacob,jacques,james,jason,jean,jeremy,jerome,jim,jimmy,joe,joel,john,jonathan,jordan,jose,joseph,julien,justin,karim,kent,kevin,kylian,laurent,leo,leon,leonard,logan,loris,louis,luc,lucas,luis,ludovic,malo,marc,marius,martin,mathieu,mathis,matt,matthew,matthieu,max,maxime,maxence,medhi,mehdi,michael,michel,mike,mohammed,morgan,nathan,nicolas,noah,noe,norbert,olivier,oscar,owen,pascal,patrick,paul,peter,philippe,pierre,quentin,rafael,raphael,remi,remy,renaud,rene,richard,robert,roger,roland,roman,romain,ronald,ruben,sacha,sam,samuel,sebastien,serge,simon,stephane,steve,sylvain,thibault,thierry,thomas,tim,timothee,timothy,tom,tristan,valentin,victor,vincent,walter,will,william,xavier,yann,yannick,yoann,yves,ywan,pere,papa,father,dad,mari,husband,fils,son,boy,garcon,frere,brother,oncle,uncle,grand-pere,grandpa,grandfather,vieux,monsieur,mr,mister,roi,king,prince,homme,man,serveur,waiter,voisin,flic,cop,soldat,soldier,pretre,priest'.split(','));
const guessGender = (name) => { const words = String(name).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z\s-]/g, '').split(/\s+/).filter(Boolean); for (const w of words) { if (FEMALE.has(w)) return 'female'; if (MALE.has(w)) return 'male'; } return null; };
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const cleanName = (s) => s.replace(/\(.*?\)/g, '').replace(/\^$/, '').replace(/\s+/g, ' ').trim().toUpperCase();
const titleCase = (s) => String(s).toLowerCase().replace(/(^|[\s.'-])(\p{L})/gu, (_m, sep, ch) => sep + ch.toUpperCase());
function chunks(text) {
  if (text.length <= 500) return [text];
  const out = []; let cur = '';
  for (const s of text.match(/[^.!?…]+[.!?…]*\s*/g) || [text]) { if (cur.length + s.length > 500 && cur) { out.push(cur.trim()); cur = ''; } cur += s; }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

// The cues. opts: narration (headings + action by the narrator), intro 'first' | 'every' | 'off', directions 'skip' | 'read'.
export function buildRead(paras, opts) {
  const o = Object.assign({ narration: true, intro: 'first', directions: 'skip' }, opts || {});
  const firstScene = paras.findIndex((p) => p.type === 'SCENE_HEADING');
  const body = firstScene > 0 ? paras.slice(firstScene) : paras;   // the title page stays silent
  const lines = []; const cast = new Map(); let cur = null; let introduced = new Set();
  const push = (l) => { lines.push(l); };
  const flush = () => {
    if (cur && cur.text) {
      const c = cast.get(cur.who) || { name: cur.who, lines: 0, chars: 0, sample: '' };
      if (o.intro === 'every' || (o.intro === 'first' && !introduced.has(cur.who))) { push({ kind: 'intro', who: 'NARRATOR', text: titleCase(cur.who) + '.' }); introduced.add(cur.who); }
      for (const d of cur.dirs) push({ kind: 'direction', who: cur.who, text: d });
      for (const t of chunks(cur.text)) { push({ kind: 'cue', who: cur.who, text: t }); c.chars += t.length; }
      c.lines++; if (!c.sample) c.sample = cur.text.slice(0, 100); cast.set(cur.who, c);
    }
    cur = null;
  };
  for (const p of body) {
    const t = (p.text || '').trim(); if (!t) continue;
    if (p.type === 'CHARACTER') { flush(); const who = cleanName(t); if (who) cur = { who, text: '', dirs: [] }; continue; }
    if (p.type === 'DIALOGUE' && cur) { cur.text = (cur.text + ' ' + t).trim(); continue; }
    if (p.type === 'PARENTHETICAL' && cur) { if (o.directions === 'read') { const d = t.replace(/^\(|\)$/g, '').trim(); if (d) cur.dirs.push(d); } continue; }
    flush();
    if (p.type === 'SCENE_HEADING') introduced = new Set();
    if (o.narration && (p.type === 'SCENE_HEADING' || p.type === 'ACTION')) for (const c of chunks(t)) push({ kind: 'narration', who: 'NARRATOR', text: c });
  }
  flush();
  const chars = lines.reduce((n, l) => n + l.text.length, 0);
  const cueChars = lines.filter((l) => l.who !== 'NARRATOR').reduce((n, l) => n + l.text.length, 0);
  return { lines, cast: [...cast.values()].sort((a, b) => b.chars - a.chars), chars, cueChars, credits: Math.ceil(RATE * chars * 100) / 100, opts: o };
}

// The previews come from the server's voice list, when it answers.
let previews = null;
export async function loadPreviews() {
  if (previews) return previews;
  try { const d = await get('/tts/voices'); previews = {}; for (const v of d.voices || []) if (v.preview_url) previews[v.voice_id] = v.preview_url; } catch (_e) { previews = {}; }
  return previews;
}
export function savedVoices() { try { return JSON.parse(localStorage.getItem(VOICES_KEY) || '{}'); } catch (_e) { return {}; } }
export function rememberVoice(name, id) { const m = savedVoices(); m[name] = id; try { localStorage.setItem(VOICES_KEY, JSON.stringify(m)); } catch (_e) { /* private mode */ } }

// A voice for everyone: the server guesses gender and age, the pane hands out distinct voices.
export async function castVoices(cast) {
  let genders = {}, ages = {};
  if (cast.length) { try { const d = await call('/tts/detect-gender', { characters: cast.slice(0, 40).map((c) => ({ name: c.name, sampleDialogue: c.sample })) }); genders = d.genders || {}; ages = d.ages || {}; } catch (_e) { /* defaults below */ } }
  const saved = savedVoices(); const out = {}; const used = new Set([NARRATOR_ID]);
  out.NARRATOR = saved.NARRATOR && VOICES.some((v) => v.voice_id === saved.NARRATOR) ? saved.NARRATOR : NARRATOR_ID;
  for (const c of cast) if (saved[c.name] && VOICES.some((v) => v.voice_id === saved[c.name])) { out[c.name] = saved[c.name]; used.add(saved[c.name]); }
  const free = (f) => VOICES.filter((v) => f(v) && !used.has(v.voice_id));
  for (const c of cast) {
    if (out[c.name]) continue;
    const g = (genders[c.name] || guessGender(c.name) || 'male').toLowerCase() === 'female' ? 'female' : 'male';
    const a = ages[c.name] || 'middle_aged';
    const pick = free((v) => v.gender === g && v.age === a)[0] || free((v) => v.gender === g)[0] || free(() => true)[0] || VOICES.filter((v) => v.gender === g)[c.lines % Math.max(1, VOICES.filter((v) => v.gender === g).length)] || VOICES[0];
    out[c.name] = pick.voice_id; used.add(pick.voice_id);
  }
  return out;
}

function voiceOptions(chosen) {
  const grp = (label, g) => `<optgroup label="${label}">${VOICES.filter((v) => v.gender === g).map((v) => `<option value="${v.voice_id}"${v.voice_id === chosen ? ' selected' : ''}>${v.name}, ${AGE[v.age]}</option>`).join('')}</optgroup>`;
  return grp('Women', 'female') + grp('Men', 'male');
}
const HEAR = '<svg class="se-i" viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M7 5v14l11-7z"/></svg>';

// The cast sheet: who speaks with which voice, what it costs, the button.
export function renderCast(el, read, chosen, balance) {
  const o = read.opts;
  const rows = read.cast.map((c) => `<div class="tr-row"><span class="tr-who">${esc(c.name)}<span class="sv-sub">${c.lines} ${c.lines === 1 ? 'line' : 'lines'}</span></span><select class="se-input tr-select" data-who="${esc(c.name)}">${voiceOptions(chosen[c.name])}</select><button class="se-mini tr-hear" data-who="${esc(c.name)}" title="Hear this voice">${HEAR}</button></div>`).join('');
  const seg = (name, val, items) => `<span class="se-switch tr-seg" data-opt="${name}">${items.map(([v, lb]) => `<button class="se-paper-opt${v === val ? ' active' : ''}" data-val="${v}">${lb}</button>`).join('')}</span>`;
  const enough = balance == null || balance >= read.credits;
  el.innerHTML = `
    <div class="se-label">The cast</div>
    <div class="sv-card tr-cast">${rows || '<div class="sv-loading">No dialogue yet. Give someone a line.</div>'}</div>
    <div class="se-label">The narrator</div>
    <div class="sv-card tr-cast">
      <div class="tr-row"><span class="tr-who">Narrator<span class="sv-sub">Names, headings and action</span></span><select class="se-input tr-select" data-who="NARRATOR">${voiceOptions(chosen.NARRATOR)}</select><button class="se-mini tr-hear" data-who="NARRATOR" title="Hear this voice">${HEAR}</button></div>
      <div class="tr-row tr-opt"><span class="tr-who">Action</span>${seg('narration', o.narration ? 'on' : 'off', [['on', 'Read'], ['off', 'Skip']])}</div>
      <div class="tr-row tr-opt"><span class="tr-who">Names</span>${seg('intro', o.intro, [['first', 'First line'], ['every', 'Every line'], ['off', 'Off']])}</div>
      <div class="tr-row tr-opt"><span class="tr-who">Directions</span>${seg('directions', o.directions, [['skip', 'Skip'], ['read', 'Read']])}</div>
    </div>
    <div class="sv-card pg-plan tr-cost">
      <div class="pg-kicker">This read</div>
      <div class="pg-desc">${read.lines.length} ${read.lines.length === 1 ? 'line' : 'lines'}, ${read.chars.toLocaleString('en')} characters. About <b>${read.credits}</b> ${read.credits === 1 ? 'credit' : 'credits'}. ${balance == null ? '' : `You have <b>${balance}</b>.`}${enough ? '' : ' Not enough for the whole script: the read stops when the credits run out.'}</div>
      <button class="se-btn se-btn-dark pg-buy" data-se="tr-start"${read.lines.length ? '' : ' disabled'}>Start the read</button>
      <div class="sv-foot tr-foot"><button class="sv-link" data-se="tr-buy">Buy ${PACK.credits} credits, ${PACK.price}</button> · <button class="sv-link" data-se="tr-balance">Check my balance</button></div>
    </div>`;
}

// The reading: one Audio element for the whole session (Safari unlocks it on the first click), lines fetched one ahead.
const SILENT = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
const audio = typeof Audio !== 'undefined' ? new Audio() : null;
const cache = new Map();
let run = null;   // { lines, chosen, lang, i, state, el, onDone }

export function unlockAudio() { if (!audio) return; try { audio.src = SILENT; audio.play().catch(() => {}); } catch (_e) { /* no audio */ } }

function toBlobUrl(b64) { const bin = atob(b64); const bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i); return URL.createObjectURL(new Blob([bytes], { type: 'audio/mpeg' })); }
async function fetchLine(line, chosen, lang) {
  const voice = chosen[line.who] || chosen.NARRATOR || NARRATOR_ID;
  const key = voice + '|' + line.text;
  if (cache.has(key)) return cache.get(key);
  const ask = () => Promise.race([call('/tts/generate-line', { text: line.text, voice_id: voice, language: lang, engine: ENGINE }), new Promise((_r, rej) => setTimeout(() => rej(new Error('The voices are slow to answer. Try again in a moment.')), 25000))]);
  let d;
  try { d = await ask(); }
  catch (e) { if (e.status === 429) { await new Promise((r) => setTimeout(r, 1600)); d = await ask(); } else throw e; }
  const url = toBlobUrl(d.audio);
  cache.set(key, url);
  if (run && typeof d.creditsRemaining === 'number') { const s = run.el.querySelector('#tr-balance'); if (s) s.textContent = d.creditsRemaining; }
  return url;
}

export function renderReader(el, read, balance) {
  el.innerHTML = `
    <div class="tr-bar">
      <button class="se-btn se-btn-dark tr-ctl" data-se="tr-pause">Pause</button>
      <button class="se-btn tr-ctl" data-se="tr-skip">Skip</button>
      <button class="se-btn tr-ctl" data-se="tr-stop">Stop</button>
      <span class="tr-pos"><b id="tr-n">1</b>/${read.lines.length}</span>
    </div>
    <div class="tr-lines" id="tr-lines">${read.lines.map((l, i) => `<div class="tr-line tr-${l.kind}" data-i="${i}"><div class="tr-line-who">${esc(l.kind === 'narration' ? '' : l.kind === 'intro' ? 'Narrator' : l.who)}</div><div class="tr-line-text">${esc(l.text)}</div></div>`).join('')}</div>
    <div class="sv-foot" id="tr-status">Credits: <span id="tr-balance">${balance == null ? '…' : balance}</span></div>`;
}

export function startRead(el, read, chosen, onDone) {
  stopRead();
  const lang = detectLanguage(read.lines.map((l) => l.text).join(' ').slice(0, 20000));
  run = { lines: read.lines, chosen, lang, i: 0, state: 'playing', el, onDone };
  if (audio) audio.onended = () => { if (run && run.state === 'playing') playAt(run.i + 1); };
  playAt(0);
}

function mark(i) {
  if (!run) return;
  run.el.querySelectorAll('.tr-line.is-now').forEach((n) => n.classList.remove('is-now'));
  run.el.querySelectorAll('.tr-line').forEach((n) => n.classList.toggle('is-past', Number(n.dataset.i) < i));
  const n = run.el.querySelector(`.tr-line[data-i="${i}"]`); const pos = run.el.querySelector('#tr-n');
  if (n) { n.classList.add('is-now'); n.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
  if (pos) pos.textContent = i + 1;
}
function pauseButton(label) { if (!run) return; const p = run.el.querySelector('[data-se="tr-pause"]'); if (p) p.textContent = label; }

async function playAt(i) {
  if (!run) return;
  if (i >= run.lines.length) { run.state = 'done'; const st = run.el.querySelector('#tr-status'); if (st) st.innerHTML = 'That is the end. <button class="sv-link" data-se="tr-again">Read it again</button> · <button class="sv-link" data-se="tr-cast">Back to the cast</button>'; const p = run.el.querySelector('[data-se="tr-pause"]'); if (p) p.hidden = true; if (run.onDone) run.onDone(); return; }
  run.i = i; mark(i);
  const my = run;
  let url;
  try { url = await fetchLine(run.lines[i], run.chosen, run.lang); }
  catch (e) {
    if (run !== my) return;
    run.state = 'paused'; pauseButton('Resume');
    const st = run.el.querySelector('#tr-status');
    if (e.data && e.data.needsCredits) { if (st) st.innerHTML = `Out of credits. <button class="sv-link" data-se="tr-buy">Buy ${PACK.credits} credits, ${PACK.price}</button> · <button class="sv-link" data-se="tr-resume">Try again</button>`; }
    else if (st) st.innerHTML = `${esc(e.message)} <button class="sv-link" data-se="tr-resume">Try again</button>`;
    return;
  }
  if (run !== my || run.state !== 'playing' || run.i !== i) return;
  if (audio) { audio.src = url; audio.play().catch(() => { run.state = 'paused'; pauseButton('Resume'); }); }
  if (i + 1 < run.lines.length) fetchLine(run.lines[i + 1], run.chosen, run.lang).catch(() => {});
}

export function pauseRead() {
  if (!run) return;
  if (run.state === 'playing') { run.state = 'paused'; if (audio) audio.pause(); pauseButton('Resume'); return; }
  if (run.state === 'paused') { run.state = 'playing'; pauseButton('Pause'); if (audio && audio.src && audio.src !== SILENT && audio.currentTime > 0 && !audio.ended) audio.play().catch(() => {}); else playAt(run.i); }
}
export function resumeRead() { if (!run) return; run.state = 'playing'; pauseButton('Pause'); playAt(run.i); }
export function skipRead() { if (!run) return; if (audio) audio.pause(); run.state = 'playing'; pauseButton('Pause'); playAt(run.i + 1); }
export function stopRead() { if (audio) { audio.onended = null; try { audio.pause(); } catch (_e) { /* nothing playing */ } } run = null; }
export function isReading() { return !!run; }

// A voice sample, from ElevenLabs' own preview.
export function hearVoice(id) { const url = previews && previews[id]; if (!url || !audio) return false; stopRead(); audio.src = url; audio.play().catch(() => {}); return true; }
