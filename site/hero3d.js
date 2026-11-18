// The hero: a paper iris. Eight creased origami petals lie over the STI emblem, fold open toward the viewer,
// and fold shut again as the page scrolls away. A tick-marked reticle turns behind it; dust drifts through.
// Needs WebGL; without it, the page keeps the static logo in .hero-fallback.
import * as THREE from 'three';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';

const host = document.querySelector('.hero-canvas');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const root = document.body.dataset.root || '';
const PAPER = 0xece8df, INK = 0x0a0b0c, SIGNAL = 0xd7262e;

if (host) {
  try { start(); } catch (err) { console.warn('hero 3D unavailable:', err); }
}

function start() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  host.append(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(0, 0, 9);

  // light: a cool key from upper left, a red rim from behind, a soft lamp that follows the cursor
  scene.add(new THREE.AmbientLight(0xffffff, 0.35));
  const key = new THREE.DirectionalLight(0xfff6ea, 2.4); key.position.set(-4, 5, 6); scene.add(key);
  const rim = new THREE.PointLight(SIGNAL, 30, 14, 2); rim.position.set(3, -2, -2.5); scene.add(rim);
  const lamp = new THREE.PointLight(0xffffff, 6, 10, 2); lamp.position.set(0, 0, 3.5); scene.add(lamp);

  const rig = new THREE.Group();      // parallax + layout
  const iris = new THREE.Group();     // everything that turns together
  rig.add(iris); scene.add(rig);

  // ---- the emblem, from the logo's own vector ------------------------------------------------------------------
  const EMBLEM_R = 1.5;
  const emblem = new THREE.Group();
  iris.add(emblem);
  new SVGLoader().load(root + 'site/brand/sti-logo.svg', data => {
    const mat = new THREE.MeshStandardMaterial({ color: PAPER, roughness: 0.55, metalness: 0.15 });
    const g = new THREE.Group();
    for (const path of data.paths) {
      for (const shape of SVGLoader.createShapes(path)) {
        const geo = new THREE.ExtrudeGeometry(shape, { depth: 2.2, bevelEnabled: true, bevelThickness: 0.5, bevelSize: 0.35, bevelSegments: 2, curveSegments: 18 });
        g.add(new THREE.Mesh(geo, mat));
      }
    }
    const box = new THREE.Box3().setFromObject(g);
    const size = box.getSize(new THREE.Vector3()), mid = box.getCenter(new THREE.Vector3());
    const s = (EMBLEM_R * 2) / Math.max(size.x, size.y);
    g.children.forEach(m => m.geometry.translate(-mid.x, -mid.y, -mid.z));
    g.scale.set(s, -s, s);             // SVG's y runs down
    emblem.add(g);
  });
  // a dark disc behind the emblem so its cut-outs read as depth, not as the page
  const back = new THREE.Mesh(new THREE.CircleGeometry(EMBLEM_R * 1.02, 96), new THREE.MeshStandardMaterial({ color: 0x111316, roughness: 1 }));
  back.position.z = -0.08; iris.add(back);

  // ---- the reticle: rings and ticks, turning slowly behind ----------------------------------------------------
  const reticle = new THREE.Group(); reticle.position.z = -0.25; rig.add(reticle);
  const lineMat = new THREE.LineBasicMaterial({ color: PAPER, transparent: true, opacity: 0.28 });
  const redMat = new THREE.LineBasicMaterial({ color: SIGNAL, transparent: true, opacity: 0.9 });
  const ring = (r, mat, seg = 256) => new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(
    Array.from({ length: seg }, (_, i) => new THREE.Vector3(Math.cos(i / seg * Math.PI * 2) * r, Math.sin(i / seg * Math.PI * 2) * r, 0))), mat);
  reticle.add(ring(2.35, lineMat), ring(3.1, lineMat));
  const ticks = [], redTicks = [];
  for (let i = 0; i < 120; i++) {
    const a = i / 120 * Math.PI * 2, long = i % 10 === 0, len = long ? 0.16 : 0.07;
    const set = i % 30 === 0 ? redTicks : ticks;
    set.push(new THREE.Vector3(Math.cos(a) * 2.35, Math.sin(a) * 2.35, 0), new THREE.Vector3(Math.cos(a) * (2.35 + len), Math.sin(a) * (2.35 + len), 0));
  }
  reticle.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(ticks), lineMat));
  reticle.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(redTicks), redMat));
  const arc = new THREE.Line(new THREE.BufferGeometry().setFromPoints(
    Array.from({ length: 64 }, (_, i) => { const a = -0.5 + i / 63 * 1.1; return new THREE.Vector3(Math.cos(a) * 3.1, Math.sin(a) * 3.1, 0); })), redMat);
  const arcSpin = new THREE.Group(); arcSpin.add(arc); reticle.add(arcSpin);

  // ---- the petals ------------------------------------------------------------------------------------------------
  const N = 8;
  const R = EMBLEM_R / Math.cos(Math.PI / N) + 0.06;   // chords clear the emblem's rim
  const petals = [];
  const paperMat = new THREE.MeshStandardMaterial({ color: PAPER, roughness: 0.92, metalness: 0, flatShading: true, side: THREE.FrontSide });
  const underMat = new THREE.MeshStandardMaterial({ color: 0x24272b, roughness: 0.7, metalness: 0.2, flatShading: true, side: THREE.BackSide });
  const creaseMat = new THREE.LineBasicMaterial({ color: SIGNAL, transparent: true, opacity: 0.7 });
  for (let i = 0; i < N; i++) {
    const a0 = (i / N) * Math.PI * 2, a1 = ((i + 1) / N) * Math.PI * 2, am = (a0 + a1) / 2;
    const half = R * Math.sin(Math.PI / N) * 0.985, d = R * Math.cos(Math.PI / N) * 0.985;
    // local frame: x along the chord (the fold line), y outward, z toward the viewer
    const A = [-half, 0, 0], B = [half, 0, 0], M = [0, 0, 0], O = [0, -d, 0], K = [0, -d * 0.42, 0.16];
    const pos = new Float32Array([...A, ...K, ...M, ...M, ...K, ...B, ...A, ...O, ...K, ...K, ...O, ...B]);
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.computeVertexNormals();
    const hinge = new THREE.Group();
    hinge.position.set(Math.cos(am) * R * Math.cos(Math.PI / N), Math.sin(am) * R * Math.cos(Math.PI / N), 0.14 + i * 0.004);
    hinge.rotation.z = am - Math.PI / 2;
    const leaf = new THREE.Group();
    leaf.add(new THREE.Mesh(geo, paperMat), new THREE.Mesh(geo, underMat), new THREE.LineSegments(new THREE.EdgesGeometry(geo, 1), creaseMat));
    hinge.add(leaf); iris.add(hinge);
    petals.push({ leaf, delay: i * 0.085 });
  }

  // ---- dust ------------------------------------------------------------------------------------------------------
  const DUST = 700, dp = new Float32Array(DUST * 3);
  for (let i = 0; i < DUST; i++) {
    const r = 2 + Math.random() * 6, t = Math.random() * Math.PI * 2, z = (Math.random() - 0.5) * 6;
    dp.set([Math.cos(t) * r, Math.sin(t) * r * 0.7, z], i * 3);
  }
  const dustGeo = new THREE.BufferGeometry(); dustGeo.setAttribute('position', new THREE.BufferAttribute(dp, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: PAPER, size: 0.018, transparent: true, opacity: 0.55, depthWrite: false }));
  scene.add(dust);

  // ---- layout, input, loop ---------------------------------------------------------------------------------------
  function resize() {
    const w = host.clientWidth, h = host.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    const visH = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z, visW = visH * camera.aspect;
    if (camera.aspect > 1.15) { rig.position.set(visW * 0.22, 0, 0); rig.scale.setScalar(Math.min(1.15, visH / 7.2)); }
    else { rig.position.set(0, visH * 0.2, 0); rig.scale.setScalar(Math.min(0.95, visW / 7.4)); }
  }
  new ResizeObserver(resize).observe(host); resize();

  const mouse = new THREE.Vector2(), aim = new THREE.Vector2();
  addEventListener('pointermove', e => { mouse.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); }, { passive: true });

  let visible = true;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) loop(); }).observe(host);

  const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const OPEN = -2.2;                 // radians: the petal folds up toward the viewer and over, outward
  const t0 = performance.now() + 500;
  let running = false;

  function frame(now) {
    const t = (now - t0) / 1000;
    const scroll = Math.min(1, scrollY / (innerHeight * 0.9));
    for (const p of petals) {
      const k = reduce ? 1 : ease(Math.min(1, Math.max(0, (t - p.delay) / 1.7)));
      const shut = reduce ? 0 : ease(scroll);
      p.leaf.rotation.x = OPEN * k * (1 - shut * 0.92);
    }
    if (!reduce) {
      aim.lerp(mouse, 0.05);
      rig.rotation.y = aim.x * 0.28; rig.rotation.x = -aim.y * 0.2;
      iris.rotation.z = Math.sin(now / 5200) * 0.06 - scroll * 0.6;
      reticle.rotation.z = now / 26000;
      arcSpin.rotation.z = -now / 3800;
      dust.rotation.y = now / 60000; dust.rotation.z = now / 90000;
      lamp.position.set(aim.x * 4, aim.y * 3, 3.5);
      emblem.rotation.y = Math.sin(now / 3100) * 0.08;
    }
    renderer.render(scene, camera);
  }
  function loop() {
    if (running) return;
    running = true;
    const step = now => {
      if (!visible) { running = false; return; }
      frame(now);
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  loop();
  document.documentElement.classList.add('has-3d');
}
