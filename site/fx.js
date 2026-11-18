// Motion for every page: the header, the live clock, scroll reveals, decoding headlines, and folds.
//   .reveal            clips in from the top when it scrolls into view
//   [data-decode]      text resolves out of scrambled glyphs when it scrolls into view
//   .dossier / .q      folds: their .tab button opens and closes the .fold beside it
(function () {
  'use strict';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // header gets a backdrop once the page moves
  const head = document.querySelector('.site-head');
  const onScroll = () => head && head.classList.toggle('scrolled', scrollY > 24);
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  // UTC clock, the way a field terminal would show it
  const clock = document.querySelector('[data-clock]');
  if (clock) {
    const pad = n => String(n).padStart(2, '0');
    const tick = () => { const d = new Date(); clock.textContent = `${d.getUTCFullYear()}.${pad(d.getUTCMonth() + 1)}.${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} UTC`; };
    tick(); setInterval(tick, 1000);
  }

  // decode: scrambled glyphs settle into the real text, left to right
  const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/\\<>[]=+*#';
  function decode(el) {
    if (reduce || el.dataset.decoded) return;
    el.dataset.decoded = '1';
    const final = el.dataset.text || (el.dataset.text = el.textContent);
    const start = performance.now();
    const dur = Math.min(1400, 380 + final.length * 28);
    function frame(now) {
      const p = Math.min(1, (now - start) / dur);
      const settled = Math.floor(final.length * p);
      let out = final.slice(0, settled);
      for (let i = settled; i < final.length; i++) out += final[i] === ' ' ? ' ' : GLYPHS[(Math.random() * GLYPHS.length) | 0];
      el.textContent = out;
      if (p < 1) requestAnimationFrame(frame); else el.textContent = final;
    }
    requestAnimationFrame(frame);
  }

  const io = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.add('in');
      if (e.target.matches('[data-decode]')) decode(e.target);
      e.target.querySelectorAll('[data-decode]').forEach(decode);
      io.unobserve(e.target);
    }
  }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' }) : null;

  function watch(root) {
    root.querySelectorAll('.reveal:not(.in), [data-decode]:not([data-decoded])').forEach(el => {
      if (io) io.observe(el); else { el.classList.add('in'); }
    });
  }
  window.SQT_FX = { watch, decode };
  watch(document);
  // Belt and braces: never leave content clipped if the observer is late (background tabs, jumps by anchor).
  const sweep = () => document.querySelectorAll('.reveal:not(.in)').forEach(el => {
    if (el.getBoundingClientRect().top < innerHeight * 0.95) {
      el.classList.add('in');
      el.querySelectorAll('[data-decode]').forEach(decode);
      if (io) io.unobserve(el);
    }
  });
  addEventListener('scroll', sweep, { passive: true });
  addEventListener('load', sweep);

  // folds, by delegation so rows drawn later by portal.js work too
  document.addEventListener('click', e => {
    const tab = e.target.closest('.dossier > .tab, .q > .tab');
    if (!tab) return;
    const item = tab.parentElement;
    const open = !item.classList.contains('is-open');
    item.classList.toggle('is-open', open);
    tab.setAttribute('aria-expanded', String(open));
    if (open) item.querySelectorAll('[data-decode]').forEach(el => { delete el.dataset.decoded; decode(el); });
  });
})();
