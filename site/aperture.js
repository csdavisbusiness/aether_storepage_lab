// APERTURE — the hero's hidden game. Loaded only when someone finds it (see hero3d.js).
//
// Paper rings turn around a red marker, each with one gap. Tap, click or press Space when the nearest ring's gap
// lines up with the marker to slip through: that ring folds away, the view eases outward to the next, and the
// rings keep coming, a little faster and a little tighter each time. Esc leaves.

const PAPER = 0xece8df, SIGNAL = 0xd7262e;
const R0 = 0.62, G = 1.3, RINGS = 6, BAND = 0.07;   // ring k sits at radius R0·G^k
const PLAYER_R = R0 * 0.7;
const SHIFT_S = 0.22;                                // seconds to ease out to the next ring
const BEST_KEY = 'sqt-aperture-best';

export function start({ THREE, renderer, scene, camera, rig, iris, reticle, dust, hero, onExit }) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const saved = { rigPos: rig.position.clone(), rigScale: rig.scale.x, rigRot: rig.rotation.clone(), iris: iris.scale.x, scroll: document.documentElement.style.overflow };
  let best = 0;
  try { best = parseInt(localStorage.getItem(BEST_KEY) || '0', 10) || 0; } catch { /* storage off */ }

  scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  document.documentElement.style.overflow = 'hidden';
  hero.classList.add('game-on');
  document.documentElement.classList.add('in-game');

  // ---- HUD ------------------------------------------------------------------------------------------------------
  const hud = document.createElement('div');
  hud.className = 'game-hud';
  hud.innerHTML = `
    <div class="g-top"><span class="label"><span class="signal">//</span> STI · Aperture</span>
      <div class="g-score" aria-live="polite"><span class="g-n">0</span><span class="label">Best <b class="g-best">${best}</b></span></div>
      <button class="g-exit" type="button" aria-label="Leave the game">Esc ✕</button></div>
    <div></div>
    <div class="g-msg"><h2 class="display">Thread the aperture</h2><p class="label">Space · click · tap when the gap meets the marker</p></div>`;
  hero.append(hud);
  const $n = hud.querySelector('.g-n'), $best = hud.querySelector('.g-best'), $msg = hud.querySelector('.g-msg');
  const say = (title, line) => { $msg.innerHTML = `<h2 class="display"></h2><p class="label"></p>`; $msg.firstChild.textContent = title; $msg.lastChild.textContent = line; $msg.classList.add('show'); };
  $msg.classList.add('show');

  // ---- the world ------------------------------------------------------------------------------------------------
  const world = new THREE.Group();
  scene.add(world);

  const marker = new THREE.Mesh(new THREE.OctahedronGeometry(0.055, 0), new THREE.MeshBasicMaterial({ color: SIGNAL, transparent: true }));
  marker.scale.set(0.8, 1.5, 0.8);
  marker.position.set(0, PLAYER_R, 0.05);
  world.add(marker);
  const core = new THREE.Mesh(new THREE.RingGeometry(0.05, 0.062, 48), new THREE.MeshBasicMaterial({ color: PAPER, transparent: true, opacity: 0.5 }));
  world.add(core);

  const rings = [];
  let score = 0, state = 'ready', shift = 1, shiftT = 0, deadT = 0, last = performance.now(), raf = 0, fit = 1;

  function gapFor(n) { return Math.max(0.5, 1.3 - n * 0.032); }                 // radians
  function speedFor(n) { return Math.min(3.1, 0.85 + n * 0.075) * (Math.random() < 0.5 ? -1 : 1); }

  function makeRing(n) {
    const gap = gapFor(n);
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: PAPER, transparent: true, side: THREE.DoubleSide });
    g.add(new THREE.Mesh(new THREE.RingGeometry(1 - BAND / 2, 1 + BAND / 2, 160, 1, gap / 2, Math.PI * 2 - gap), mat));
    const capMat = new THREE.MeshBasicMaterial({ color: SIGNAL, transparent: true });
    for (const a of [gap / 2, -gap / 2]) {                                       // red creases at the gap's edges
      const cap = new THREE.Mesh(new THREE.PlaneGeometry(0.014, BAND * 2.2), capMat);
      cap.position.set(Math.cos(a), Math.sin(a), 0.001); cap.rotation.z = a - Math.PI / 2;
      g.add(cap);
    }
    const ticks = [];                                                             // fine ticks so the spin reads
    for (let i = 0; i < 36; i++) {
      const a = gap / 2 + 0.08 + (i / 36) * (Math.PI * 2 - gap - 0.16);
      ticks.push(new THREE.Vector3(Math.cos(a) * (1 + BAND * 0.9), Math.sin(a) * (1 + BAND * 0.9), 0),
                 new THREE.Vector3(Math.cos(a) * (1 + BAND * 1.6), Math.sin(a) * (1 + BAND * 1.6), 0));
    }
    const tickMat = new THREE.LineBasicMaterial({ color: PAPER, transparent: true });
    g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(ticks), tickMat));
    g.rotation.z = Math.random() * Math.PI * 2;
    world.add(g);
    const flips = n >= 12 && Math.random() < Math.min(0.5, (n - 10) * 0.04);  // later rings may change direction
    return { g, gap, speed: speedFor(n), mat, capMat, tickMat, flips, flipAt: 0.8 + Math.random() * 1.2, folded: 0 };
  }

  function reset() {
    for (const r of rings) disposeRing(r);
    rings.length = 0;
    for (let k = 0; k < RINGS; k++) rings.push(makeRing(k));
    score = 0; $n.textContent = '0'; shift = 1; state = 'ready';
    marker.material.opacity = 1; marker.position.set(0, PLAYER_R, 0.05); marker.rotation.set(0, 0, 0);
  }
  function disposeRing(r) {
    world.remove(r.g);
    r.g.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    r.mat.dispose(); r.capMat.dispose(); r.tickMat.dispose();
  }

  const angleDiff = (a, b) => { let d = (a - b) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };

  function press() {
    if (state === 'dead') { if (deadT > 0.45) { reset(); $msg.classList.remove('show'); state = 'run'; } return; }
    if (state === 'ready') { state = 'run'; $msg.classList.remove('show'); }
    if (shift < 1) return;                                                       // still easing out
    const r = rings[0];
    const margin = 0.07;                                                         // the marker's own half-width
    if (Math.abs(angleDiff(r.g.rotation.z, Math.PI / 2)) < r.gap / 2 - margin) {
      score++; $n.textContent = String(score);
      shift = 0; shiftT = 0;
      rings.push(makeRing(score + RINGS - 1));
    } else {
      state = 'dead'; deadT = 0;
      r.mat.color.set(SIGNAL);
      if (score > best) { best = score; try { localStorage.setItem(BEST_KEY, String(best)); } catch { /* storage off */ } }
      $best.textContent = String(best);
      say('Signal lost', `${score} ring${score === 1 ? '' : 's'} · ${score >= best && score > 0 ? 'new best · ' : ''}tap to retry · Esc to leave`);
    }
  }

  // ---- layout + loop --------------------------------------------------------------------------------------------
  const ease = t => 1 - Math.pow(1 - t, 3);
  function layout(dt) {
    const visH = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
    const visW = visH * camera.aspect;
    fit = Math.min(visW, visH * 0.92) / (2 * R0 * Math.pow(G, RINGS - 1) * 1.08);
    world.scale.setScalar(fit);
    const k = Math.min(1, dt * 4);                                               // the hero's rig eases to centre
    rig.position.lerp(new THREE.Vector3(0, 0, -0.5), k);
    rig.scale.setScalar(rig.scale.x + (fit * 1.05 - rig.scale.x) * k);
    rig.rotation.x *= 1 - k; rig.rotation.y *= 1 - k;
    iris.scale.setScalar(Math.max(0.0001, iris.scale.x * (1 - k * 1.5)));
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    layout(dt);
    if (shift < 1) { shiftT += dt; shift = Math.min(1, shiftT / SHIFT_S); }
    const s = ease(shift);
    rings.forEach((r, i) => {
      // ring i eases from its old place (i) to its new one (i - 1) while a shift runs
      const idx = shift < 1 ? i - s : i;
      const radius = R0 * Math.pow(G, idx);
      r.g.scale.setScalar(radius);
      if (state !== 'dead' || i > 0) {
        if (r.flips && state === 'run') { r.flipAt -= dt; if (r.flipAt <= 0) { r.speed = -r.speed; r.flipAt = 0.9 + Math.random() * 1.3; } }
        r.g.rotation.z += r.speed * dt * (state === 'ready' ? 0.6 : 1);
      }
      const fade = Math.max(0.12, 1 - Math.max(0, idx) * 0.16);
      r.mat.opacity = fade; r.tickMat.opacity = fade * 0.45; r.capMat.opacity = Math.min(1, fade * 1.4);
    });
    // the ring just passed folds away inward, like a page turning
    if (shift < 1 && rings.length > RINGS) {
      const gone = rings[0];
      gone.g.rotation.x = s * Math.PI * 0.5;
      gone.mat.opacity = gone.tickMat.opacity = gone.capMat.opacity = 1 - s;
    } else if (rings.length > RINGS) {
      disposeRing(rings.shift());
    }
    // the marker: a small breath, a hop on each pass, a tumble on a miss
    if (state === 'dead') {
      deadT += dt;
      marker.position.y += dt * 0.6; marker.rotation.z += dt * 9; marker.rotation.x += dt * 5;
      marker.material.opacity = Math.max(0, 1 - deadT * 1.6);
    } else {
      const hop = shift < 1 ? Math.sin(s * Math.PI) * 0.06 : 0;
      marker.position.y = PLAYER_R + hop + (reduce ? 0 : Math.sin(now / 420) * 0.008);
      marker.rotation.y += dt * 1.6;
    }
    reticle.rotation.z += dt * (state === 'run' ? 0.08 + score * 0.004 : 0.03);
    dust.rotation.z += dt * 0.01;
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }

  // ---- input ------------------------------------------------------------------------------------------------------
  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); exit(); return; }
    if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowUp') { e.preventDefault(); if (!e.repeat) press(); }
  }
  function onPointer(e) {
    if (e.target.closest('.g-exit')) return;
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault(); press();
  }
  addEventListener('keydown', onKey);
  hero.addEventListener('pointerdown', onPointer);
  hud.querySelector('.g-exit').addEventListener('click', exit);

  function exit() {
    cancelAnimationFrame(raf);
    removeEventListener('keydown', onKey);
    hero.removeEventListener('pointerdown', onPointer);
    for (const r of rings) disposeRing(r);
    marker.geometry.dispose(); marker.material.dispose(); core.geometry.dispose(); core.material.dispose();
    scene.remove(world);
    hud.remove();
    hero.classList.remove('game-on');
    document.documentElement.classList.remove('in-game');
    document.documentElement.style.overflow = saved.scroll;
    rig.position.copy(saved.rigPos); rig.scale.setScalar(saved.rigScale); rig.rotation.copy(saved.rigRot);
    iris.scale.setScalar(saved.iris);
    onExit();
  }

  reset();
  raf = requestAnimationFrame(t => { last = t; frame(t); });
  if (location.search.includes('aperture-debug')) {                              // for testing only
    window.__aperture = {
      press, exit,
      get score() { return score; }, get state() { return state; }, get rings() { return rings.length; },
      aligned: () => Math.abs(angleDiff(rings[0].g.rotation.z, Math.PI / 2)) < rings[0].gap / 2 - 0.1 && shift >= 1,
    };
  }
}
