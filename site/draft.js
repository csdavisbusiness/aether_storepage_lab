// DRAFT — the footer's hidden game. Loaded only when someone finds it (see fx.js: drag a loop around Squish).
//
// Draw a track on drafting paper, then ride it: the sheet flips to a blueprint, white on black, and Squish rides
// a folded-paper sled down whatever you drew. Red lines boost in the direction they were drawn. Hit your head and
// you're off the sled. Six levels each have a printed course, a red finish gate and an ink budget: reach the gate
// with less ink for more stamps. The free sheet has no rules. Space rides and stops, Esc leaves. Tracks and stamps
// are kept in this browser.

const INK = [10, 11, 12], PAPER = [236, 232, 223], SIGNAL = '#d7262e';
const STEPS = 10, H = 1 / (60 * STEPS);           // physics substeps per 60 Hz tick
const GRAV = 900, BOOST = 900, FRICTION = 0.00005; // px/s², px/s² along a red line, tangential loss per contact
const R_SLED = 2.5, R_HEAD = 10;
const CELL = 96;
const FREE_KEY = 'sqt-draft-track', PROGRESS_KEY = 'sqt-draft-progress';
const STARTER = [{ k: 'n', p: [-90, 6, -20, 7, 40, 14, 100, 30, 170, 62, 250, 110, 340, 170, 430, 222, 520, 256, 610, 268, 700, 262, 780, 240] }];

// Squish always starts at 0,0 (his sled needs ground just below). `goal` is the finish gate: x, and the height of
// the ground it stands on. `ink` is the budget in world pixels, `par` the most ink that still earns three stamps.
const n = (...p) => ({ k: 'n', p });
// a smooth curve through the given points (Catmull-Rom, a point every ~8 px): sharp corners cost speed
export function smooth(p, step = 8) {
  const out = [p[0], p[1]];
  for (let i = 0; i + 3 < p.length; i += 2) {
    const x0 = p[Math.max(0, i - 2)], y0 = p[Math.max(1, i - 1)], x1 = p[i], y1 = p[i + 1], x2 = p[i + 2], y2 = p[i + 3];
    const x3 = p[Math.min(p.length - 2, i + 4)], y3 = p[Math.min(p.length - 1, i + 5)];
    const m = Math.max(1, Math.round(Math.hypot(x2 - x1, y2 - y1) / step));
    for (let j = 1; j <= m; j++) {
      const t = j / m, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push(Math.round(f(x0, x1, x2, x3) * 10) / 10, Math.round(f(y0, y1, y2, y3) * 10) / 10);
    }
  }
  return out;
}
const c = (...p) => ({ k: 'n', p: smooth(p) });
export const LEVELS = [
  { id: 'gap', name: 'Gap', brief: 'The track breaks. Bridge it.', ink: 420, par: 170, goal: { x: 640, y: 80 },
    course: [c(-60, 5, 40, 12, 120, 40, 200, 74, 260, 80), n(260, 80, 320, 80), n(470, 80, 760, 80)] },
  { id: 'climb', name: 'Climb', brief: 'The gate is higher than you are. Red lines push.', ink: 360, par: 150, goal: { x: 660, y: -70 },
    course: [c(-60, 5, 40, 14, 120, 44, 180, 58, 230, 60), n(230, 60, 330, 60), c(330, 60, 400, 40, 470, -10, 530, -55, 580, -70), n(580, -70, 780, -70)] },
  { id: 'beam', name: 'Beam', brief: 'Mind your head. Go under, not through.', ink: 420, par: 220, goal: { x: 660, y: 100 },
    course: [c(-60, 5, 40, 14, 120, 48, 200, 92, 260, 100), n(260, 100, 300, 100), n(500, 100, 780, 100), n(350, 72, 450, 72)] },
  { id: 'drop', name: 'Drop', brief: 'A long way down, and the floor is over there.', ink: 760, par: 500, goal: { x: 680, y: 400 },
    course: [c(-60, 5, 40, 12, 110, 26), n(520, 400, 800, 400)] },
  { id: 'wall', name: 'Wall', brief: 'Over the top. Build a kicker.', ink: 420, par: 170, goal: { x: 760, y: 200 },
    course: [c(-60, 5, 40, 16, 120, 60, 200, 130, 260, 180, 330, 200), n(330, 200, 900, 200), n(520, 200, 520, 140)] },
  { id: 'tour', name: 'Grand tour', brief: 'Everything at once, on a tight budget.', ink: 640, par: 480, goal: { x: 1160, y: -30 },
    course: [c(-60, 5, 40, 14, 120, 48, 200, 92, 260, 100), n(260, 100, 300, 100), n(420, 100, 520, 100), n(560, 72, 640, 72),
      n(680, 100, 800, 100), c(800, 100, 880, 90, 960, 40, 1030, -15, 1080, -30), n(1080, -30, 1260, -30)] },
];

// ---- physics: a rigid triangle (sled back, sled front, head) of Verlet points riding line segments -------------
export function makeSim() {
  let grid = new Map(), segs = [];
  const sim = { pts: null, sticks: null, crashed: false, runT: 0, ticks: 0, trail: [] };
  sim.setTrack = lists => {
    segs = []; grid = new Map();
    for (const list of lists) for (const s of list) for (let i = 0; i + 3 < s.p.length; i += 2) {
      const g = { x1: s.p[i], y1: s.p[i + 1], x2: s.p[i + 2], y2: s.p[i + 3], boost: s.k === 'b' };
      const dx = g.x2 - g.x1, dy = g.y2 - g.y1, len = Math.hypot(dx, dy);
      if (len < 0.5) continue;
      g.tx = dx / len; g.ty = dy / len; g.len = len;
      segs.push(g);
      const c0x = Math.floor(Math.min(g.x1, g.x2) / CELL), c1x = Math.floor(Math.max(g.x1, g.x2) / CELL);
      const c0y = Math.floor(Math.min(g.y1, g.y2) / CELL), c1y = Math.floor(Math.max(g.y1, g.y2) / CELL);
      for (let a = c0x; a <= c1x; a++) for (let b = c0y; b <= c1y; b++) {
        const key = a + ',' + b; let l = grid.get(key); if (!l) grid.set(key, l = []); l.push(g);
      }
    }
    sim.segCount = segs.length;
  };
  function near(x0, y0, x1, y1, pad) {
    const out = new Set();
    const c0x = Math.floor((Math.min(x0, x1) - pad) / CELL), c1x = Math.floor((Math.max(x0, x1) + pad) / CELL);
    const c0y = Math.floor((Math.min(y0, y1) - pad) / CELL), c1y = Math.floor((Math.max(y0, y1) + pad) / CELL);
    for (let a = c0x; a <= c1x; a++) for (let b = c0y; b <= c1y; b++) { const l = grid.get(a + ',' + b); if (l) for (const g of l) out.add(g); }
    return out;
  }
  sim.spawn = () => {
    const mk = (x, y, r) => ({ x, y, px: x, py: y, r });
    const pts = sim.pts = [mk(-14, 0, R_SLED), mk(14, 0, R_SLED), mk(0, -20, R_HEAD)];
    const st = (a, b) => ({ a, b, len: Math.hypot(pts[a].x - pts[b].x, pts[a].y - pts[b].y) });
    sim.sticks = [st(0, 1), st(0, 2), st(1, 2)];
    sim.crashed = false; sim.runT = 0; sim.ticks = 0; sim.trail = [];
  };
  let boostDir = null;
  function collide(p, isHead) {
    let hit = false;
    for (const g of near(p.px, p.py, p.x, p.y, p.r + 1)) {
      // a crossing since the last substep: put the point back on the side it came from
      const ex = p.x - p.px, ey = p.y - p.py, gx = g.x2 - g.x1, gy = g.y2 - g.y1;
      const den = ex * gy - ey * gx;
      if (Math.abs(den) > 1e-9) {
        const t = ((g.x1 - p.px) * gy - (g.y1 - p.py) * gx) / den, u = ((g.x1 - p.px) * ey - (g.y1 - p.py) * ex) / den;
        if (t >= 0 && t <= 1 && u >= 0 && u <= 1) { p.x = p.px + ex * t * 0.98; p.y = p.py + ey * t * 0.98; }
      }
      let s = ((p.x - g.x1) * g.tx + (p.y - g.y1) * g.ty); s = Math.max(0, Math.min(g.len, s));
      const qx = g.x1 + g.tx * s, qy = g.y1 + g.ty * s;
      let nx = p.x - qx, ny = p.y - qy; const d = Math.hypot(nx, ny);
      if (d >= p.r) continue;
      if (d > 1e-6) { nx /= d; ny /= d; }
      else { nx = -g.ty; ny = g.tx; if ((p.px - qx) * nx + (p.py - qy) * ny < 0) { nx = -nx; ny = -ny; } }
      p.x = qx + nx * p.r; p.y = qy + ny * p.r;
      let vx = p.x - p.px, vy = p.y - p.py;
      const vn = vx * nx + vy * ny;
      if (vn < 0) { vx -= nx * vn; vy -= ny * vn; }
      vx *= 1 - FRICTION; vy *= 1 - FRICTION;
      p.px = p.x - vx; p.py = p.y - vy;
      if (g.boost && !isHead) boostDir = g;
      hit = true;
    }
    return hit;
  }
  sim.centre = () => ({ x: (sim.pts[0].x + sim.pts[1].x) / 2, y: (sim.pts[0].y + sim.pts[1].y) / 2 });
  // one 60 Hz tick; returns 'crash' on the tick Squish's head meets a line
  sim.tick = () => {
    const pts = sim.pts; let event = null;
    for (let s = 0; s < STEPS; s++) {
      for (const p of pts) {
        const vx = p.x - p.px, vy = p.y - p.py;
        p.px = p.x; p.py = p.y;
        p.x += vx; p.y += vy + GRAV * H * H;
      }
      boostDir = null;
      for (let it = 0; it < 3; it++) {
        for (const k of sim.sticks) {
          const a = pts[k.a], b = pts[k.b];
          const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1e-6, f = (d - k.len) / d / 2;
          a.x += dx * f; a.y += dy * f; b.x -= dx * f; b.y -= dy * f;
        }
        collide(pts[0], false); collide(pts[1], false);
        if (collide(pts[2], true) && !sim.crashed) {
          sim.crashed = true; event = 'crash';
          sim.sticks = sim.sticks.filter(k => k.a !== 2 && k.b !== 2);   // the head leaves the sled
        }
      }
      // a red line under the sled pushes the whole rider along it (pushing only the sled would tip him over)
      if (boostDir) for (const p of sim.crashed ? pts.slice(0, 2) : pts) { p.px -= boostDir.tx * BOOST * H * H; p.py -= boostDir.ty * BOOST * H * H; }
    }
    sim.runT += 1 / 60;
    const c = sim.centre();
    if (++sim.ticks % 2 === 0) sim.trail.push(c.x, c.y);
    if (sim.trail.length > 3000) sim.trail.splice(0, 2);
    return event;
  };
  return sim;
}

// has the sled's middle passed through a level's finish gate between two ticks?
export function throughGate(goal, a, b) {
  if (!goal || a.x >= goal.x || b.x < goal.x) return false;
  const y = a.y + (b.y - a.y) * (goal.x - a.x) / ((b.x - a.x) || 1);
  return y > goal.y - 90 && y < goal.y + 12;
}
export const inkOf = strokes => strokes.reduce((sum, s) => { for (let i = 0; i + 3 < s.p.length; i += 2) sum += Math.hypot(s.p[i + 2] - s.p[i], s.p[i + 3] - s.p[i + 1]); return sum; }, 0);
export const stampsFor = (lv, used) => used <= lv.par ? 3 : used <= (lv.par + lv.ink) / 2 ? 2 : 1;

export function start({ from, onExit } = {}) {
  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const savedOverflow = root.style.overflow;
  root.style.overflow = 'hidden';
  root.classList.add('in-game', 'in-draft');

  // ---- overlay + HUD ---------------------------------------------------------------------------------------------
  const el = document.createElement('div');
  el.className = 'draft';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', 'Draft, a hidden drawing game');
  const clamp = (v, max) => Math.max(0, Math.min(max, v));
  const ox = from ? clamp(from.x, innerWidth) : innerWidth / 2, oy = from ? clamp(from.y, innerHeight) : innerHeight / 2;
  el.style.setProperty('--ox', ox + 'px'); el.style.setProperty('--oy', oy + 'px');
  const TOOLS = [['pen', '1', 'Pen'], ['line', '2', 'Line'], ['boost', '3', 'Boost'], ['erase', '4', 'Erase'], ['hand', '5', 'Pan']];
  el.innerHTML = `
    <canvas></canvas>
    <div class="d-top"><div class="d-title"><span class="label"><span class="signal">//</span> STI · Draft <b class="d-level"></b></span>
        <div class="d-ink"><span class="d-bar"><i></i></span><span class="label">Ink <b class="d-used">0</b> / <span class="d-budget">0</span></span></div></div>
      <div class="d-read" aria-live="off"><span class="d-speed">0</span><span class="label">km/h · <b class="d-time">0.0</b> s</span></div>
      <button class="d-btn d-exit" type="button" aria-label="Leave the game">Esc ✕</button></div>
    <div class="d-msg"></div>
    <div class="d-menu" hidden><h2 class="display">Draft</h2>
      <p class="label">Get Squish through the red gate · less ink, more stamps</p>
      <ol class="d-levels"></ol>
      <button class="d-btn d-free" type="button" data-level="free">Free sheet · no rules</button></div>
    <div class="d-tools">
      <button class="d-btn" type="button" data-act="menu" title="Levels (M)">☰ Levels</button>
      <span class="d-sep"></span>
      ${TOOLS.map(([t, k, n]) => `<button class="d-btn d-tool" type="button" data-tool="${t}" title="${n} (${k})"><i>${k}</i>${n}</button>`).join('')}
      <span class="d-sep"></span>
      <button class="d-btn" type="button" data-act="undo" title="Undo (Ctrl+Z)">Undo</button>
      <button class="d-btn" type="button" data-act="clear" title="Clear your lines">Clear</button>
      <span class="d-sep"></span>
      <button class="d-btn d-ride" type="button" data-act="ride" title="Ride / stop (Space)">▶ Ride</button>
    </div>`;
  document.body.append(el);
  requestAnimationFrame(() => el.classList.add('open'));
  const $ = s => el.querySelector(s);
  const cv = $('canvas'), cx = cv.getContext('2d');
  const $speed = $('.d-speed'), $time = $('.d-time'), $msg = $('.d-msg'), $ride = $('.d-ride'), $menu = $('.d-menu');
  const $used = $('.d-used'), $budget = $('.d-budget'), $bar = $('.d-bar i'), $level = $('.d-level');
  function say(title, line, button) {
    $msg.replaceChildren();
    const h = document.createElement('h2'); h.className = 'display'; h.textContent = title;
    const p = document.createElement('p'); p.className = 'label'; p.textContent = line;
    $msg.append(h, p);
    if (button) { const b = document.createElement('button'); b.className = 'd-btn d-ride'; b.type = 'button'; b.textContent = button[0]; b.addEventListener('click', button[1]); $msg.append(b); }
    $msg.classList.add('show');
  }
  const hush = () => $msg.classList.remove('show');
  const stampText = k => '■'.repeat(k) + '□'.repeat(3 - k);

  const head = new Image();
  head.src = new URL('brand/squish-head.png', import.meta.url).href;

  // ---- progress, levels, the track ------------------------------------------------------------------------------
  let progress = {};
  try { progress = JSON.parse(localStorage.getItem(PROGRESS_KEY)) || {}; } catch { /* none */ }
  const store = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage off */ } };

  const sim = makeSim();
  let level = null, course = [], strokes = [], history = [], ghost = [];
  function save() {
    if (level) { (progress[level.id] = progress[level.id] || {}).lines = strokes; store(PROGRESS_KEY, progress); }
    else store(FREE_KEY, strokes);
  }
  function rebuild() { sim.setTrack([course, strokes]); meter(); }
  function meter() {
    el.classList.toggle('free', !level);
    if (!level) return;
    const used = inkOf(strokes);
    $used.textContent = String(Math.round(used)); $budget.textContent = String(level.ink);
    $bar.style.transform = `scaleX(${Math.min(1, used / level.ink)})`;
    el.classList.toggle('dry', used >= level.ink - 1);
  }
  function loadLevel(i) {
    if (mode === 'run') stop();
    level = i === 'free' ? null : LEVELS[i];
    course = level ? level.course : [];
    let mine = null;
    try { mine = level ? progress[level.id] && progress[level.id].lines : JSON.parse(localStorage.getItem(FREE_KEY)); } catch { /* none */ }
    strokes = Array.isArray(mine) ? mine : level ? [] : JSON.parse(JSON.stringify(STARTER));
    history = []; ghost = [];
    $level.textContent = level ? `· ${String(i + 1).padStart(2, '0')} ${level.name}` : '· Free sheet';
    rebuild(); sim.spawn(); fit(); closeMenu();
    if (level) say(level.name, `${level.brief} · ${level.ink} ink · Space to ride`);
    else say('Free sheet', 'Draw anything · Space to ride · red lines boost');
  }
  function renderMenu() {
    $('.d-levels').replaceChildren(...LEVELS.map((lv, i) => {
      const li = document.createElement('li'), b = document.createElement('button');
      const best = progress[lv.id] && progress[lv.id].best || 0;
      b.type = 'button'; b.className = 'd-btn'; b.dataset.level = String(i);
      b.innerHTML = `<i>${String(i + 1).padStart(2, '0')}</i><span></span><b class="st${best ? '' : ' none'}">${best ? stampText(best) : '———'}</b>`;
      b.querySelector('span').textContent = lv.name;
      li.append(b); return li;
    }));
  }
  function openMenu() { if (mode === 'run') stop(); renderMenu(); hush(); $menu.hidden = false; el.classList.add('menu'); const b = $menu.querySelector('button'); if (b) b.focus({ preventScroll: true }); }
  function closeMenu() { $menu.hidden = true; el.classList.remove('menu'); }
  $menu.addEventListener('click', e => { const b = e.target.closest('[data-level]'); if (b) loadLevel(b.dataset.level === 'free' ? 'free' : +b.dataset.level); });

  // ---- camera, modes --------------------------------------------------------------------------------------------
  let W = 0, Hh = 0, dpr = 1;
  const cam = { x: 200, y: 90, z: 1.4 }, editCam = { ...cam };
  let mode = 'edit', flip = 0;                                  // flip: 0 paper .. 1 blueprint
  function resize() {
    dpr = Math.min(2, devicePixelRatio || 1); W = innerWidth; Hh = innerHeight;
    cv.width = W * dpr; cv.height = Hh * dpr; cv.style.width = W + 'px'; cv.style.height = Hh + 'px';
  }
  resize(); addEventListener('resize', resize);
  function fit() {                                                // frame the whole course
    let x0 = -60, x1 = 400, y0 = -60, y1 = 120;
    const pts = level ? [...course.flatMap(s => s.p), level.goal.x, level.goal.y - 90] : STARTER[0].p.slice(0, 16);
    for (let i = 0; i < pts.length; i += 2) { x0 = Math.min(x0, pts[i]); x1 = Math.max(x1, pts[i]); y0 = Math.min(y0, pts[i + 1]); y1 = Math.max(y1, pts[i + 1]); }
    cam.x = (x0 + x1) / 2; cam.y = (y0 + y1) / 2;
    cam.z = Math.max(0.4, Math.min(1.4, (W - 64) / (x1 - x0 + 80), (Hh - 220) / (y1 - y0 + 80)));
    Object.assign(editCam, cam);
  }
  const toWorld = (sx, sy) => ({ x: (sx - W / 2) / cam.z + cam.x, y: (sy - Hh / 2) / cam.z + cam.y });

  let won = false;
  function ride() {
    if (mode === 'run') return stop();
    closeMenu();
    mode = 'run'; won = false; Object.assign(editCam, cam); sim.spawn(); hush();
    el.classList.add('run'); $ride.textContent = '■ Stop';
  }
  function stop() {
    mode = 'edit'; ghost = sim.trail.slice(); Object.assign(cam, editCam); sim.spawn(); hush();
    el.classList.remove('run'); $ride.textContent = '▶ Ride';
  }
  function win() {
    won = true;
    const used = Math.round(inkOf(strokes)), k = stampsFor(level, used), rec = progress[level.id] = progress[level.id] || {};
    const better = k > (rec.best || 0);
    if (better) rec.best = k;
    save();
    const i = LEVELS.indexOf(level), next = LEVELS[i + 1];
    const tip = k < 3 ? ` · ${level.par} ink or less for three` : '';
    say(`Cleared ${stampText(k)}`, `${used} ink${tip}${better && rec.best === k && k > 1 ? ' · new best' : ''}`,
      next ? [`Next · ${next.name} ▸`, () => loadLevel(i + 1)] : ['All levels ▸', openMenu]);
  }

  // ---- drawing --------------------------------------------------------------------------------------------------
  let tool = 'pen', drag = null;
  function setTool(t) { tool = t; el.querySelectorAll('.d-tool').forEach(b => b.classList.toggle('on', b.dataset.tool === t)); cv.dataset.tool = t; }
  setTool('pen');
  const left = () => level ? level.ink - inkOf(strokes) : Infinity;
  // a line started or finished near another line's end joins it exactly (an overlap leaves a lip the sled snags on)
  function snap(w, skip) {
    let best = null, bd = 12 / cam.z;
    for (const s of [...course, ...strokes]) {
      if (s === skip) continue;
      for (const i of [0, s.p.length - 2]) { const d = Math.hypot(s.p[i] - w.x, s.p[i + 1] - w.y); if (d < bd) { bd = d; best = { x: s.p[i], y: s.p[i + 1] }; } }
    }
    return best || w;
  }

  function erase(w) {
    const r = 12 / cam.z; let changed = false;
    const out = [];
    for (const s of strokes) {
      let cur = [s.p[0], s.p[1]];
      for (let i = 0; i + 3 < s.p.length; i += 2) {
        const x1 = s.p[i], y1 = s.p[i + 1], x2 = s.p[i + 2], y2 = s.p[i + 3];
        const dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy || 1;
        const t = Math.max(0, Math.min(1, ((w.x - x1) * dx + (w.y - y1) * dy) / l2));
        if (Math.hypot(x1 + dx * t - w.x, y1 + dy * t - w.y) < r) {
          changed = true; if (cur.length >= 4) out.push({ k: s.k, p: cur }); cur = [x2, y2];
        } else cur.push(x2, y2);
      }
      if (cur.length >= 4) out.push({ k: s.k, p: cur });
    }
    if (changed) { strokes = out; rebuild(); }
  }

  cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('pointerdown', e => {
    e.preventDefault();
    try { cv.setPointerCapture(e.pointerId); } catch { /* not a live pointer */ }
    if (!$menu.hidden) closeMenu();
    const w = toWorld(e.clientX, e.clientY);
    if (e.button === 1 || e.button === 2 || tool === 'hand' || mode === 'run') { drag = { pan: true, sx: e.clientX, sy: e.clientY, cx: cam.x, cy: cam.y }; return; }
    if (e.button !== 0) return;
    hush(); snapshot();
    if (tool === 'erase') { drag = { erase: true }; erase(w); return; }
    if (left() < 2) { say('Out of ink', 'Erase a line or undo to free some up'); history.pop(); return; }
    const at = snap(w);
    const s = { k: tool === 'boost' ? 'b' : 'n', p: [Math.round(at.x), Math.round(at.y)] };
    strokes.push(s); drag = { s, line: tool === 'line', base: inkOf(strokes) };
  });
  cv.addEventListener('pointermove', e => {
    if (!drag) return;
    if (drag.pan) { cam.x = drag.cx - (e.clientX - drag.sx) / cam.z; cam.y = drag.cy - (e.clientY - drag.sy) / cam.z; if (mode === 'edit') Object.assign(editCam, cam); return; }
    const w = toWorld(e.clientX, e.clientY);
    if (drag.erase) return erase(w);
    const p = drag.s.p;
    if (drag.line) {
      // a straight line stops where the ink runs out
      const to = snap(w, drag.s);
      const room = level ? level.ink - drag.base : Infinity, dx = to.x - p[0], dy = to.y - p[1], l = Math.hypot(dx, dy), k = l > room ? room / l : 1;
      p.length = 2; p.push(Math.round(p[0] + dx * k), Math.round(p[1] + dy * k));
    } else {
      const lx = p[p.length - 2], ly = p[p.length - 1], l = Math.hypot(w.x - lx, w.y - ly);
      if (l < 7 / cam.z) return;
      const room = left();
      if (room < 1) { el.classList.add('dry'); return; }
      const k = l > room ? room / l : 1;
      p.push(Math.round(lx + (w.x - lx) * k), Math.round(ly + (w.y - ly) * k));
    }
    rebuild();
  });
  const up = () => {
    if (!drag) return;
    const s = drag.s;
    if (s && s.p.length < 4) strokes.splice(strokes.indexOf(s), 1);
    else if (s && !drag.line) {                                   // join the end too, if it fits the ink
      const L = s.p.length, end = snap({ x: s.p[L - 2], y: s.p[L - 1] }, s);
      const extra = Math.hypot(end.x - s.p[L - 4], end.y - s.p[L - 3]) - Math.hypot(s.p[L - 2] - s.p[L - 4], s.p[L - 1] - s.p[L - 3]);
      if (extra <= left()) { s.p[L - 2] = end.x; s.p[L - 1] = end.y; }
    }
    drag = null; rebuild(); save();
  };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('wheel', e => {
    e.preventDefault();
    const before = toWorld(e.clientX, e.clientY);
    cam.z = Math.min(3, Math.max(0.25, cam.z * Math.exp(-e.deltaY * 0.0015)));
    const after = toWorld(e.clientX, e.clientY);
    cam.x += before.x - after.x; cam.y += before.y - after.y;
    if (mode === 'edit') Object.assign(editCam, cam);
  }, { passive: false });

  function snapshot() { history.push(JSON.stringify(strokes)); if (history.length > 60) history.shift(); }
  function act(a) {
    if (a === 'ride') ride();
    else if (a === 'menu') { if ($menu.hidden) openMenu(); else closeMenu(); }
    else if (a === 'undo') { if (mode === 'run') stop(); const h = history.pop(); if (h) { strokes = JSON.parse(h); rebuild(); save(); } }
    else if (a === 'clear') { if (mode === 'run') stop(); snapshot(); strokes = []; ghost = []; rebuild(); save(); say('A clean sheet', 'Ctrl+Z brings it back'); }
  }
  $('.d-tools').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.tool) { if (mode === 'run') stop(); setTool(b.dataset.tool); closeMenu(); }
    if (b.dataset.act) act(b.dataset.act);
    b.blur();
  });
  $('.d-exit').addEventListener('click', exit);
  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); return $menu.hidden ? exit() : closeMenu(); }
    if (e.target.closest && e.target.closest('.d-menu button, .d-msg button') && (e.key === 'Enter' || e.key === ' ')) return;   // let it click
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (!e.repeat) ride(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); return act('undo'); }
    if (e.key.toLowerCase() === 'm') return act('menu');
    if (e.key.toLowerCase() === 'n' && won && level && LEVELS.indexOf(level) < LEVELS.length - 1) return loadLevel(LEVELS.indexOf(level) + 1);
    const t = TOOLS.find(([, k]) => k === e.key); if (t) { if (mode === 'run') stop(); setTool(t[0]); }
    if (e.key === '+' || e.key === '=') cam.z = Math.min(3, cam.z * 1.2);
    if (e.key === '-') cam.z = Math.max(0.25, cam.z / 1.2);
  }
  addEventListener('keydown', onKey, true);

  // ---- render ---------------------------------------------------------------------------------------------------
  const mix = (a, b, t, al = 1) => `rgba(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')},${al})`;
  let raf = 0, last = performance.now(), acc = 0;
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    const target = mode === 'run' ? 1 : 0;
    flip += (target - flip) * (reduce ? 1 : Math.min(1, dt * 9));
    if (mode === 'run') {
      acc += dt;
      while (acc >= 1 / 60) {
        const before = sim.centre();
        const ev = sim.tick(); acc -= 1 / 60;
        if (ev === 'crash' && !won) say('Wiped out', `${sim.runT.toFixed(1)} s · Space to reset · keep drawing`);
        if (level && !won && !sim.crashed && throughGate(level.goal, before, sim.centre())) win();
      }
      const p = sim.pts, f = sim.crashed ? p[2] : p[0];          // after a wipeout the camera follows Squish
      const c = sim.crashed ? p[2] : sim.centre(), vx = (f.x - f.px) / H, vy = (f.y - f.py) / H;
      cam.x += (c.x + vx * 0.25 - cam.x) * Math.min(1, dt * 5);
      cam.y += (c.y + vy * 0.25 - cam.y) * Math.min(1, dt * 5);
      $speed.textContent = String(Math.round(Math.hypot(vx, vy) / 20 * 3.6));
      $time.textContent = sim.runT.toFixed(1);
    } else acc = 0;
    draw();
    raf = requestAnimationFrame(frame);
  }

  function draw() {
    const fg = mix(INK, PAPER, flip), z = cam.z;
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx.fillStyle = mix(PAPER, INK, flip); cx.fillRect(0, 0, W, Hh);
    // drafting grid, or blueprint grid
    const minor = 32 * z, major = minor * 5;
    for (const [step, al] of [[minor, 0.06], [major, 0.13]]) {
      if (step < 6) continue;
      cx.strokeStyle = mix(INK, PAPER, flip, al); cx.lineWidth = 1; cx.beginPath();
      const x0 = ((W / 2 - cam.x * z) % step + step) % step, y0 = ((Hh / 2 - cam.y * z) % step + step) % step;
      for (let x = x0; x < W; x += step) { cx.moveTo(Math.round(x) + 0.5, 0); cx.lineTo(Math.round(x) + 0.5, Hh); }
      for (let y = y0; y < Hh; y += step) { cx.moveTo(0, Math.round(y) + 0.5); cx.lineTo(W, Math.round(y) + 0.5); }
      cx.stroke();
    }
    cx.setTransform(dpr * z, 0, 0, dpr * z, dpr * (W / 2 - cam.x * z), dpr * (Hh / 2 - cam.y * z));
    cx.lineCap = 'round'; cx.lineJoin = 'round';
    const poly = (p, color, w) => {
      if (p.length < 4) return;
      cx.strokeStyle = color; cx.lineWidth = w / z; cx.beginPath(); cx.moveTo(p[0], p[1]);
      for (let i = 2; i < p.length; i += 2) cx.lineTo(p[i], p[i + 1]);
      cx.stroke();
    };
    // the last run's path, faint, while drafting; the live one while riding
    if (mode === 'edit' && ghost.length) poly(ghost, 'rgba(215,38,46,.28)', 1.5);
    if (mode === 'run') poly(sim.trail, 'rgba(215,38,46,.75)', 1.5);
    // the level's printed course: heavier, with hatching underneath so it reads as fixed
    for (const s of course) {
      poly(s.p, fg, 3.2);
      cx.strokeStyle = mix(INK, PAPER, flip, 0.3); cx.lineWidth = 1 / z; cx.beginPath();
      for (let i = 0; i + 3 < s.p.length; i += 2) {
        const dx = s.p[i + 2] - s.p[i], dy = s.p[i + 3] - s.p[i + 1], l = Math.hypot(dx, dy);
        if (Math.abs(dx) < Math.abs(dy) * 0.5) continue;             // walls and posts go unhatched
        for (let d = 6; d < l; d += 9) { const x = s.p[i] + dx * d / l, y = s.p[i + 1] + dy * d / l; cx.moveTo(x, y + 2); cx.lineTo(x - 5, y + 8); }
      }
      cx.stroke();
    }
    for (const s of strokes) {
      poly(s.p, s.k === 'b' ? SIGNAL : fg, s.k === 'b' ? 2.6 : 2);
      if (s.k === 'b') chevrons(s.p);
    }
    // start mark, and the finish gate
    cx.strokeStyle = SIGNAL; cx.lineWidth = 1.5 / z; cx.beginPath();
    cx.moveTo(-22, 8); cx.lineTo(-22, -46); cx.lineTo(-8, -40); cx.lineTo(-22, -34); cx.stroke();
    if (level) {
      const { x, y } = level.goal;
      cx.lineWidth = 2 / z; cx.beginPath(); cx.moveTo(x, y); cx.lineTo(x, y - 90); cx.stroke();
      cx.fillStyle = SIGNAL;
      for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) if ((r + c) % 2 === 0) cx.fillRect(x + c * 6, y - 90 + r * 6, 6, 6);
      cx.strokeRect(x, y - 90, 24, 12);
      cx.setLineDash([3 / z, 4 / z]); cx.globalAlpha = 0.5; cx.beginPath(); cx.moveTo(x, y); cx.lineTo(x, y - 90); cx.stroke();
      cx.setLineDash([]); cx.globalAlpha = 1;
    }
    rider(fg);
  }
  function chevrons(p) {
    let run = 0;
    cx.strokeStyle = SIGNAL; cx.lineWidth = 1.5 / cam.z; cx.beginPath();
    for (let i = 0; i + 3 < p.length; i += 2) {
      const dx = p[i + 2] - p[i], dy = p[i + 3] - p[i + 1], l = Math.hypot(dx, dy); if (!l) continue;
      run += l;
      if (run < 40) continue; run = 0;
      const tx = dx / l, ty = dy / l, nx = -ty, ny = tx, mx = p[i + 2] - nx * 7, my = p[i + 3] - ny * 7;
      cx.moveTo(mx - tx * 4 + nx * 3, my - ty * 4 + ny * 3); cx.lineTo(mx, my); cx.lineTo(mx - tx * 4 - nx * 3, my - ty * 4 - ny * 3);
    }
    cx.stroke();
  }
  function rider(fg) {
    const [a, b, h] = sim.pts;
    const ang = Math.atan2(b.y - a.y, b.x - a.x), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    // the sled: a folded strip of paper with a red crease and an upturned nose
    cx.save(); cx.translate(mx, my); cx.rotate(ang);
    cx.fillStyle = fg; cx.beginPath();
    cx.moveTo(-17, -1); cx.lineTo(13, -1); cx.quadraticCurveTo(20, -1, 21, -9); cx.lineTo(23, -9); cx.quadraticCurveTo(22, 2, 13, 2); cx.lineTo(-17, 2); cx.closePath(); cx.fill();
    cx.strokeStyle = SIGNAL; cx.lineWidth = 1; cx.beginPath(); cx.moveTo(-15, 0.5); cx.lineTo(12, 0.5); cx.stroke();
    cx.restore();
    // Squish
    const hang = sim.crashed ? Math.atan2(h.y - h.py, h.x - h.px) + sim.runT * 4 : ang;
    cx.save(); cx.translate(h.x, h.y); cx.rotate(hang);
    cx.imageSmoothingEnabled = false;
    cx.beginPath(); cx.arc(0, 0, 12, 0, Math.PI * 2);              // a round badge: the portrait's sky stays inside it
    if (head.complete && head.naturalWidth) { cx.save(); cx.clip(); cx.drawImage(head, -13, -14, 26, 26); cx.restore(); }
    else { cx.fillStyle = fg; cx.fill(); }
    cx.strokeStyle = fg; cx.lineWidth = 1.5 / cam.z; cx.stroke();
    cx.restore();
    if (!sim.crashed) {                                           // a neck, so he reads as sitting on the sled
      cx.strokeStyle = fg; cx.lineWidth = 2 / cam.z; cx.beginPath();
      cx.moveTo(mx, my - 1); cx.lineTo(h.x + (mx - h.x) * 0.45, h.y + (my - h.y) * 0.45); cx.stroke();
    }
  }

  // ---- leave ----------------------------------------------------------------------------------------------------
  let gone = false;
  function exit() {
    if (gone) return; gone = true;
    removeEventListener('keydown', onKey, true);
    removeEventListener('resize', resize);
    save();
    el.classList.remove('open'); el.classList.add('closing');
    setTimeout(() => {
      cancelAnimationFrame(raf); el.remove();
      root.classList.remove('in-game', 'in-draft'); root.style.overflow = savedOverflow;
      if (onExit) onExit();
    }, reduce ? 0 : 650);
  }

  // open on the first level not yet cleared, with the level list showing
  const firstOpen = LEVELS.findIndex(lv => !(progress[lv.id] && progress[lv.id].best));
  loadLevel(firstOpen < 0 ? 0 : firstOpen);
  hush(); openMenu();
  raf = requestAnimationFrame(t => { last = t; frame(t); });
  if (location.search.includes('draft-debug')) {                  // for testing only
    window.__draft = { ride, stop, exit, act, loadLevel, openMenu,
      get state() { const c = sim.centre(); return { mode, won, crashed: sim.crashed, runT: sim.runT, x: c.x, y: c.y, level: level && level.id, ink: Math.round(inkOf(strokes)), strokes: strokes.length }; } };
  }
}
