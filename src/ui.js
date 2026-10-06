// ui.js — all HUD behaviour: profile/XP/gold, nav tiles, event timers,
// stat chips with rules tooltips, the encounter picker and the Play flow,
// plus settings and quit. Values are rendered from data.js so the HUD and
// the (future) save system share one source of truth.

import { HERO, ENCOUNTERS, NAV_TILES, EVENTS, VARIANT_RULES, RESTOCK_MS } from './data.js';

const $ = (s) => document.querySelector(s);
const el = (tag, cls, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
};
const icon = (id) => `<svg><use href="#${id}"/></svg>`;

// ---------------------------------------------------------------------------
// settings persistence
// ---------------------------------------------------------------------------
const DEFAULT_SETTINGS = {
  variants: { flanking: false, encumbrance: false, grittyCrits: false, permadeath: false },
  video: { quality: 'high', reducedMotion: false },
  audio: { master: 80, music: 70, sfx: 90 },
  controls: { invertY: false },
  a11y: { colorblind: 'none', textScale: 1.0 },
};
const SETTINGS_KEY = 'dicebound.settings';

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return structuredClone(DEFAULT_SETTINGS);
    const s = JSON.parse(raw);
    // deep-merge over defaults so new keys appear after updates
    const out = structuredClone(DEFAULT_SETTINGS);
    for (const k of Object.keys(out)) Object.assign(out[k], s[k] || {});
    return out;
  } catch { return structuredClone(DEFAULT_SETTINGS); }
}
export function saveSettings(s) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

// ---------------------------------------------------------------------------
// tooltip
// ---------------------------------------------------------------------------
let ttEl = null;
function tooltip() {
  if (!ttEl) { ttEl = el('div'); ttEl.id = 'tooltip'; document.body.appendChild(ttEl); }
  return ttEl;
}
function bindTooltip(node, title, body) {
  const read = (v) => (typeof v === 'function' ? v() : v);
  node.addEventListener('pointerenter', () => {
    const t = tooltip();
    t.innerHTML = `<div class="tt-title"></div><div class="tt-body"></div>`;
    t.querySelector('.tt-title').textContent = read(title);
    t.querySelector('.tt-body').textContent = read(body);
    t.style.opacity = 1;
  });
  node.addEventListener('pointermove', (e) => {
    const t = tooltip();
    const pad = 14;
    let x = e.clientX + pad, y = e.clientY + pad;
    const r = t.getBoundingClientRect();
    if (x + r.width > innerWidth - 8) x = e.clientX - r.width - pad;
    if (y + r.height > innerHeight - 8) y = e.clientY - r.height - pad;
    t.style.left = x + 'px'; t.style.top = y + 'px';
  });
  node.addEventListener('pointerleave', () => { tooltip().style.opacity = 0; });
}

// ---------------------------------------------------------------------------
// modals & toasts
// ---------------------------------------------------------------------------
const modalRoot = () => $('#modal-root');

function openModal({ title, iconId, body, actions = [] }) {
  const root = modalRoot();
  root.innerHTML = '';
  const modal = el('div', 'modal');
  const h2 = el('h2', null, `${iconId ? icon(iconId) : ''}<span></span>`);
  h2.querySelector('span').textContent = title;
  const bodyEl = el('div', 'modal-body');
  if (typeof body === 'string') bodyEl.innerHTML = body; else bodyEl.appendChild(body);
  modal.append(h2, bodyEl);
  const close = () => { root.innerHTML = ''; document.removeEventListener('keydown', onKey); };
  if (actions.length) {
    const bar = el('div', 'modal-actions');
    for (const a of actions) {
      const b = el('button', 'btn' + (a.class ? ' ' + a.class : ''), a.label);
      b.addEventListener('click', () => { const keep = a.onClick?.(); if (!keep) close(); });
      bar.appendChild(b);
    }
    modal.appendChild(bar);
  }
  root.appendChild(modal);
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  root.addEventListener('pointerdown', (e) => { if (e.target === root) close(); });
  return { close, modal };
}

function toast(msg, gold = false, ms = 3200) {
  const t = el('div', 'toast' + (gold ? ' gold' : ''), msg);
  $('#toast-root').appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 450); }, ms);
}

// ---------------------------------------------------------------------------
// HUD sections
// ---------------------------------------------------------------------------
function renderProfile(hero) {
  $('#profile-name').textContent = hero.name;
  $('#profile-sub').textContent = `${hero.species} ${hero.className} · Level ${hero.level}`;
  const pct = Math.min(100, (hero.xp / hero.xpNext) * 100);
  $('#xp-fill').style.width = pct + '%';
  $('#xp-label').textContent = `${hero.xp} / ${hero.xpNext} XP`;
  $('#gold-value').textContent = hero.gold.toLocaleString('en-US');
}

function renderTiles() {
  const icons = { characters: 'i-helm', armory: 'i-anvil', bestiary: 'i-book', collection: 'i-gem' };
  const nav = $('#tiles');
  nav.innerHTML = '';
  for (const t of NAV_TILES) {
    const b = el('button', 'tile panel');
    b.innerHTML = `
      <span class="tile-icon">${icon(icons[t.id])}</span>
      <span class="tile-text">
        <span class="tile-title"></span>
        <span class="tile-desc"></span>
      </span>
      ${t.tag ? `<span class="tile-tag"></span>` : ''}`;
    b.querySelector('.tile-title').textContent = t.title;
    b.querySelector('.tile-desc').textContent = t.desc;
    if (t.tag) b.querySelector('.tile-tag').textContent = t.tag;
    b.addEventListener('click', () => openRoadmap(t));
    nav.appendChild(b);
  }
}

function openRoadmap(tile) {
  openModal({
    title: tile.title,
    iconId: { characters: 'i-helm', armory: 'i-anvil', bestiary: 'i-book', collection: 'i-gem' }[tile.id],
    body: `<p>${tile.roadmap}</p><p class="summary-note">This screen is still being forged —
      the build order starts with the character sheet, then combat, the Play screen and the shop.</p>`,
    actions: [{ label: 'Close' }],
  });
}

// --- events with live countdowns -------------------------------------------
function nextMidnight() { const d = new Date(); d.setHours(24, 0, 0, 0); return d.getTime(); }
function restockAt() {
  let at = Number(localStorage.getItem('dicebound.restockAt') || 0);
  const now = Date.now();
  if (!at || at < now - RESTOCK_MS) at = now + RESTOCK_MS;
  if (at <= now) at += RESTOCK_MS;
  localStorage.setItem('dicebound.restockAt', String(at));
  return at;
}
function fmtMs(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m ${String(ss).padStart(2, '0')}s`;
}
function renderEvents() {
  const wrap = $('#events');
  wrap.innerHTML = '';
  for (const ev of EVENTS) {
    const c = el('article', 'event-card panel');
    c.innerHTML = `
      <div class="event-head">${icon('i-hour')}<span></span></div>
      <div class="event-body"></div>
      <div class="event-foot">
        <span class="event-reward"></span>
        <span class="event-timer"></span>
      </div>`;
    c.querySelector('.event-head span').textContent = ev.title;
    c.querySelector('.event-body').textContent = ev.body;
    c.querySelector('.event-reward').textContent = ev.reward;
    c.dataset.timer = ev.timer;
    wrap.appendChild(c);
  }
  const tick = () => {
    const now = Date.now();
    for (const c of wrap.children) {
      const target = c.dataset.timer === 'daily' ? nextMidnight() : restockAt();
      const label = c.dataset.timer === 'daily' ? 'resets in ' : 'arrives in ';
      c.querySelector('.event-timer').textContent = label + fmtMs(target - now);
    }
  };
  tick();
  setInterval(tick, 1000);
}

// --- stats + weapon ----------------------------------------------------------
function renderStats(hero) {
  const s = hero.stats;
  const fmtSign = (n) => (n >= 0 ? '+' : '') + n;
  const chips = [
    { icon: 'i-shield', v: s.ac, label: 'AC', tt: ['Armor Class', s.acNote + '. Attack rolls must meet or beat this to hit.'] },
    { icon: 'i-heart', v: `${s.hp}/${s.hpMax}`, label: 'HP', tt: ['Hit Points', s.hpNote + '. At 0 HP you fall unconscious and make death saves.'] },
    { icon: 'i-boot', v: fmtSign(s.initiative), label: 'Init', tt: ['Initiative bonus', s.initNote + '. Rolled against the monsters to set turn order.'] },
    { icon: 'i-star', v: fmtSign(s.prof), label: 'Prof', tt: ['Proficiency bonus', s.profNote + '. Added to attacks, saves and skills you are proficient with.'] },
  ];
  const wrap = $('#stats');
  wrap.innerHTML = '';
  const row = el('div', 'stat-chips');
  for (const c of chips) {
    const chip = el('div', 'chip', `${icon(c.icon)}<b>${c.v}</b><span>${c.label}</span>`);
    bindTooltip(chip, c.tt[0], c.tt[1]);
    row.appendChild(chip);
  }
  wrap.appendChild(row);
  const w = hero.weapon;
  const wl = el('div', 'weapon-line', `
    ${icon('i-sword')}
    <div>
      <span class="w-name"></span>
      <span class="w-detail"></span><br>
      <span class="w-mastery"></span>
    </div>`);
  wl.querySelector('.w-name').textContent = w.name + '  ';
  wl.querySelector('.w-detail').textContent = `${fmtSign(w.attackBonus)} to hit · ${w.damage} ${w.damageType} · ${w.properties}`;
  wl.querySelector('.w-mastery').textContent = `Mastery: ${w.mastery}`;
  bindTooltip(wl, w.name, w.note);
  wrap.appendChild(wl);
}

// --- encounter picker + play --------------------------------------------------
let encIndex = 0;
function renderEncounter() {
  const e = ENCOUNTERS[encIndex];
  $('#enc-map').textContent = e.map;
  $('#enc-name').textContent = e.name;
  $('#enc-monsters').textContent = e.monsters;
  $('#enc-level').textContent = `Lv ${e.level}`;
  const diff = $('#enc-diff');
  diff.textContent = e.difficulty;
  diff.className = 'enc-diff ' + e.difficulty.toLowerCase();
  $('#enc-reward').textContent = `Reward: ${e.xp} XP · ${e.gold} gp`;
}
function cycleEncounter(dir) {
  encIndex = (encIndex + dir + ENCOUNTERS.length) % ENCOUNTERS.length;
  renderEncounter();
}

function openPlay() {
  const e = ENCOUNTERS[encIndex];
  const body = el('div');
  body.innerHTML = `
    <div class="summary-list">
      <div><span>Character</span><span></span></div>
      <div><span>Encounter</span><span></span></div>
      <div><span>Map</span><span></span></div>
      <div><span>Monsters</span><span></span></div>
      <div><span>Difficulty</span><span></span></div>
      <div><span>Party</span><span>Solo (hirelings arrive later)</span></div>
      <div><span>Estimated reward</span><span style="color:#7fb069"></span></div>
    </div>
    <p class="summary-note"></p>`;
  const rows = body.querySelectorAll('.summary-list div span:last-child');
  rows[0].textContent = `${HERO.name} — Level ${HERO.level} ${HERO.className}`;
  rows[1].textContent = e.name;
  rows[2].textContent = e.map;
  rows[3].textContent = e.monsters;
  rows[4].textContent = e.difficulty;
  rows[6].textContent = `${e.xp} XP · ${e.gold} gp`;
  body.querySelector('.summary-note').textContent = e.note;

  openModal({
    title: 'Ready for battle?',
    iconId: 'i-swords',
    body,
    actions: [
      { label: 'Not yet', class: 'ghost' },
      {
        label: 'Enter the arena',
        onClick: () => {
          const m = openModal({
            title: e.name,
            iconId: 'i-d20',
            body: `<div class="seeking">
              <svg class="spin"><use href="#i-d20"/></svg>
              <p>Polishing the grid, waking the monsters…</p>
            </div>`,
          });
          setTimeout(() => {
            m.close();
            toast('The arena gates open in the next update — combat is next in the build order.', true, 4200);
          }, 1900);
        },
      },
    ],
  });
}

// --- settings ------------------------------------------------------------------
function settingToggleRow(name, desc, get, set) {
  const row = el('div', 'setting-row');
  row.innerHTML = `<div><div class="s-name"></div><div class="s-desc"></div></div>`;
  row.querySelector('.s-name').textContent = name;
  row.querySelector('.s-desc').textContent = desc;
  const t = el('button', 'toggle' + (get() ? ' on' : ''));
  t.setAttribute('role', 'switch');
  t.addEventListener('click', () => { const v = !get(); set(v); t.classList.toggle('on', v); });
  row.appendChild(t);
  return row;
}
function settingSelectRow(name, desc, options, get, set) {
  const row = el('div', 'setting-row');
  row.innerHTML = `<div><div class="s-name"></div><div class="s-desc"></div></div>`;
  row.querySelector('.s-name').textContent = name;
  row.querySelector('.s-desc').textContent = desc;
  const sel = el('select');
  for (const [v, label] of options) sel.appendChild(new Option(label, v));
  sel.value = get();
  sel.addEventListener('change', () => set(sel.value));
  row.appendChild(sel);
  return row;
}
function settingSliderRow(name, desc, get, set, min = 0, max = 100, step = 1) {
  const row = el('div', 'setting-row');
  row.innerHTML = `<div><div class="s-name"></div><div class="s-desc"></div></div>`;
  row.querySelector('.s-name').textContent = name;
  row.querySelector('.s-desc').textContent = desc;
  const inp = el('input');
  inp.type = 'range'; inp.min = min; inp.max = max; inp.step = step; inp.value = get();
  inp.addEventListener('input', () => set(Number(inp.value)));
  row.appendChild(inp);
  return row;
}

function openSettings(ctx) {
  const s = ctx.settings;
  const body = el('div');
  const tabs = el('div', 'settings-tabs');
  const pane = el('div');
  const persist = () => saveSettings(s);

  const panes = {
    Variants() {
      const d = el('div');
      for (const v of VARIANT_RULES) {
        d.appendChild(settingToggleRow(v.name, v.desc,
          () => s.variants[v.id],
          (val) => { s.variants[v.id] = val; persist(); }));
      }
      d.appendChild(el('p', 'summary-note', 'Variant rules apply to every match you start. They are documented adaptations, never silent ones.'));
      return d;
    },
    Video() {
      const d = el('div');
      d.appendChild(settingSelectRow('Quality', 'Shadow resolution, pixel ratio and particles.',
        [['low', 'Low'], ['medium', 'Medium'], ['high', 'High']],
        () => s.video.quality,
        (v) => { s.video.quality = v; persist(); ctx.hub.setQuality(v); }));
      d.appendChild(settingToggleRow('Reduced motion', 'Calms camera drift, breathing, flames and embers.',
        () => s.video.reducedMotion,
        (v) => { s.video.reducedMotion = v; persist(); applyA11y(ctx); }));
      return d;
    },
    Audio() {
      const d = el('div');
      d.appendChild(settingSliderRow('Master volume', 'Everything at once.', () => s.audio.master, (v) => { s.audio.master = v; persist(); }));
      d.appendChild(settingSliderRow('Music', 'Tavern strings and battle drums.', () => s.audio.music, (v) => { s.audio.music = v; persist(); }));
      d.appendChild(settingSliderRow('Effects', 'Dice, steel and spellwork.', () => s.audio.sfx, (v) => { s.audio.sfx = v; persist(); }));
      d.appendChild(el('p', 'summary-note', 'The bards arrive with the audio pass — these levels are saved for them.'));
      return d;
    },
    Controls() {
      const d = el('div');
      d.appendChild(settingToggleRow('Invert camera Y', 'Inverts vertical camera drift in the hub.',
        () => s.controls.invertY, (v) => { s.controls.invertY = v; persist(); applyControls(ctx); }));
      const list = el('div', 'summary-list', `
        <div><span>Cycle encounter</span><span>← / →</span></div>
        <div><span>Play</span><span>Enter</span></div>
        <div><span>Settings</span><span>S</span></div>
        <div><span>Quit</span><span>Q</span></div>
        <div><span>Close dialog</span><span>Esc</span></div>`);
      d.appendChild(list);
      d.appendChild(el('p', 'summary-note', 'Controller support and full rebinding ship with combat.'));
      return d;
    },
    Accessibility() {
      const d = el('div');
      d.appendChild(settingSelectRow('Colorblind mode', 'Rebalances accents for common color-vision types.',
        [['none', 'None'], ['deuter', 'Deuteranopia'], ['protan', 'Protanopia'], ['tritan', 'Tritanopia']],
        () => s.a11y.colorblind,
        (v) => { s.a11y.colorblind = v; persist(); applyA11y(ctx); }));
      d.appendChild(settingSliderRow('Text size', 'Scales the interface text.',
        () => Math.round(s.a11y.textScale * 100), (v) => { s.a11y.textScale = v / 100; persist(); applyA11y(ctx); }, 85, 130, 5));
      return d;
    },
  };

  let active = 'Variants';
  const show = (name) => {
    active = name;
    for (const b of tabs.children) b.classList.toggle('active', b.textContent === name);
    pane.innerHTML = '';
    pane.appendChild(panes[name]());
  };
  for (const name of Object.keys(panes)) {
    const b = el('button', null, name);
    b.addEventListener('click', () => show(name));
    tabs.appendChild(b);
  }
  body.append(tabs, pane);
  show(active);

  openModal({ title: 'Settings', iconId: 'i-gear', body, actions: [{ label: 'Done' }] });
}

function applyA11y(ctx) {
  const s = ctx.settings;
  document.documentElement.style.setProperty('--text-scale', s.a11y.textScale);
  document.documentElement.classList.toggle('rm', s.video.reducedMotion);
  document.body.className = s.a11y.colorblind !== 'none' ? 'cb-' + s.a11y.colorblind : '';
  ctx.hub.setReducedMotion(s.video.reducedMotion);
}
function applyControls(ctx) {
  ctx.hub.invertY = ctx.settings.controls.invertY;
}

// --- quit ----------------------------------------------------------------------
function openQuit() {
  openModal({
    title: 'Leave the tavern?',
    iconId: 'i-quit',
    body: '<p>Your hero keeps every coin and experience point earned so far (which is, admittedly, none at all — go win a fight first!).</p>',
    actions: [
      { label: 'Stay', class: 'ghost' },
      {
        label: 'Quit', class: 'danger',
        onClick: () => {
          const shade = el('div');
          shade.id = 'loader';
          shade.innerHTML = `<div class="loader-inner"><svg><use href="#i-d20"/></svg>
            <p style="font-size:1.1rem">The hearth dims… farewell, adventurer.</p>
            <p style="margin-top:.6rem;font-size:.8rem;font-style:italic">(close the tab, or)</p>
            <button class="btn" style="margin-top:1rem" onclick="location.reload()">Return to the tavern</button></div>`;
          document.body.appendChild(shade);
          requestAnimationFrame(() => shade.classList.remove('done'));
          shade.style.opacity = 0;
          requestAnimationFrame(() => { shade.style.opacity = 1; });
        },
      },
    ],
  });
}

// ---------------------------------------------------------------------------
export function initUI(hub) {
  const ctx = { hub, settings: loadSettings() };

  renderProfile(HERO);
  renderTiles();
  renderEvents();
  renderStats(HERO);
  renderEncounter();
  bindTooltip($('#enc-card'), () => ENCOUNTERS[encIndex].name, () => ENCOUNTERS[encIndex].note);

  // encounter picker
  $('#enc-prev').addEventListener('click', () => cycleEncounter(-1));
  $('#enc-next').addEventListener('click', () => cycleEncounter(1));
  $('#btn-play').addEventListener('click', openPlay);
  $('#btn-settings').addEventListener('click', () => openSettings(ctx));
  $('#btn-quit').addEventListener('click', openQuit);

  // keyboard shortcuts (controller-friendly first step)
  document.addEventListener('keydown', (e) => {
    if ($('#modal-root').children.length) return; // modal handles Esc itself
    if (e.target.matches('input, select, textarea')) return;
    if (e.key === 'ArrowLeft') cycleEncounter(-1);
    else if (e.key === 'ArrowRight') cycleEncounter(1);
    else if (e.key === 'Enter') openPlay();
    else if (e.key === 's' || e.key === 'S') openSettings(ctx);
    else if (e.key === 'q' || e.key === 'Q') openQuit();
  });

  // apply persisted settings to scene + DOM
  applyA11y(ctx);
  applyControls(ctx);
  hub.setQuality(ctx.settings.video.quality);

  return ctx;
}
