// The site's side of the playtest portal: the access terminal, the playtest dossiers, and every download button.
// Markup hooks:  [data-access]            an access-code panel
//                [data-games]             the list of playtest dossiers
//                [data-download="slug"]   a download widget for one game
// <body data-root="../../"> on pages below the site root, so asset paths resolve.
(function () {
  'use strict';
  const cfg = window.SQT_CONFIG || {};
  const portal = String(cfg.portalUrl || '').replace(/\/+$/, '');
  const GAMES = window.SQT_GAMES || [];
  const root = document.body.dataset.root || '';
  const STORE = 'sqt-access-v1';

  let access = load();
  let catalog = null;          // {slug: release} once fetched
  let catalogFailed = false;

  function load() { try { return JSON.parse(localStorage.getItem(STORE) || 'null'); } catch { return null; } }
  function save(a) { access = a; try { a ? localStorage.setItem(STORE, JSON.stringify(a)) : localStorage.removeItem(STORE); } catch { /* private window */ } }

  const el = (tag, props = {}, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? '' : v);
    }
    n.append(...kids.filter(k => k != null && k !== false));
    return n;
  };
  const svg = (tag, attrs = {}) => { const n = document.createElementNS('http://www.w3.org/2000/svg', tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); return n; };
  const mb = bytes => bytes >= 1e9 ? (bytes / 1e9).toFixed(2) + ' GB' : Math.max(1, Math.round(bytes / 1e6)) + ' MB';
  const day = iso => { try { const d = new Date(iso); return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`; } catch { return ''; } };
  const game = slug => GAMES.find(g => g.slug === slug) || { slug, title: slug };
  const arrow = () => el('span', { class: 'arrow', 'aria-hidden': 'true', text: '→' });
  const watch = node => window.SQT_FX && window.SQT_FX.watch(node);

  // A barcode drawn from the game's name: same bars every time, different for every game.
  function barcode(seed) {
    let h = 2166136261;
    for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    const s = svg('svg', { class: 'barcode', viewBox: '0 0 180 30', preserveAspectRatio: 'none', 'aria-hidden': 'true' });
    for (let x = 0; x < 176;) {
      h = Math.imul(h ^ (h >>> 13), 1274126177);
      const w = 1 + ((h >>> 3) & 3), gap = 1 + ((h >>> 7) & 3);
      s.append(svg('rect', { x, y: 0, width: w, height: (h & 31) > 3 ? 30 : 22, fill: '#ece8df' }));
      x += w + gap;
    }
    return s;
  }

  // ---- portal calls -------------------------------------------------------------------------------------------

  async function checkCode(code) {
    const res = await fetch(portal + '/access', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code }) });
    const data = await res.json().catch(() => ({}));
    if (res.status === 403) return { ok: false, error: data.error || "That access code isn't valid." };
    if (!res.ok) throw new Error(data.error || 'The portal is unavailable right now.');
    return data;
  }

  async function fetchCatalog() {
    if (!portal) return;
    try {
      const res = await fetch(portal + '/catalog');
      if (!res.ok) throw new Error(res.status);
      catalog = Object.fromEntries(((await res.json()).games || []).map(g => [g.slug, g]));
    } catch { catalogFailed = true; }
    renderDownloads();
    renderStates();
  }

  async function download(slug, button) {
    const label = [...button.childNodes];
    button.disabled = true; button.textContent = 'Opening channel…';
    const restore = () => { button.disabled = false; button.replaceChildren(...label); };
    try {
      const check = await checkCode(access.code);
      if (!check.ok) { save(null); renderAll(); flash('Your access code no longer works. Ask us for a new one.', true); return; }
      save({ ...access, name: check.name, games: check.games });
      // A form post, so the code travels in the body (never the address bar) and the browser saves the file itself.
      const form = el('form', { method: 'POST', action: `${portal}/download/${encodeURIComponent(slug)}`, class: 'sr' },
        el('input', { type: 'hidden', name: 'code', value: access.code }));
      document.body.append(form); form.submit(); form.remove();
      setTimeout(restore, 4000);
    } catch (err) {
      restore();
      flash(err.message || 'The portal is unavailable right now.', true);
    }
  }

  // ---- access terminal ----------------------------------------------------------------------------------------

  function flash(text, isErr) {
    document.querySelectorAll('[data-access] .msg').forEach(m => { m.textContent = text; m.classList.toggle('err', !!isErr); });
  }

  function focusAccess() {
    const input = document.querySelector('[data-access] input');
    if (input) { input.scrollIntoView({ block: 'center', behavior: 'smooth' }); setTimeout(() => input.focus({ preventScroll: true }), 350); }
    else location.href = root + '#access';
  }

  function renderAccess(panel) {
    panel.classList.add('frame');
    const msg = el('p', { class: 'msg', role: 'status', 'aria-live': 'polite' });
    if (access) {
      const n = access.games ? access.games.length : 0;
      panel.replaceChildren(
        el('div', { class: 'head' }, el('h2', { text: 'Clearance' }), el('span', { class: 'granted', text: 'GRANTED' })),
        el('div', { class: 'who' }, el('span', { class: 'name', 'data-decode': '', text: access.name || 'Playtester' })),
        el('p', { text: n === GAMES.length ? 'Every playtest is open to you.' : `${n} of ${GAMES.length} playtests are open to you.` }),
        el('button', { class: 'btn-link', type: 'button', text: 'Use a different code', onclick: () => { save(null); renderAll(); focusAccess(); } }),
        msg);
      watch(panel);
      return;
    }
    const input = el('input', { id: 'access-code-' + Math.random().toString(36).slice(2, 7), name: 'code', autocomplete: 'off', spellcheck: 'false', placeholder: 'XXXXX-XXXXX-XXXXX', maxlength: '40', required: true });
    const submit = el('button', { class: 'btn btn-primary', type: 'submit' }, 'Unlock', arrow());
    const form = el('form', {
      onsubmit: async e => {
        e.preventDefault();
        if (!portal) { msg.classList.remove('err'); msg.textContent = 'Downloads open soon.'; return; }
        submit.disabled = true; msg.classList.remove('err'); msg.textContent = 'Verifying…';
        try {
          const r = await checkCode(input.value.trim());
          if (!r.ok) { msg.textContent = r.error; msg.classList.add('err'); return; }
          save({ code: input.value.trim().toUpperCase(), name: r.name, games: r.games });
          renderAll();
        } catch (err) { msg.textContent = err.message; msg.classList.add('err'); }
        finally { submit.disabled = false; }
      },
    }, el('label', { class: 'sr', for: input.id, text: 'Access code' }), input, submit);
    panel.replaceChildren(
      el('div', { class: 'head' }, el('h2', { text: 'Enter access code' }), el('span', { class: 'label', text: 'Invite only' })),
      el('p', { text: 'Enter the code we sent you. It unlocks your playtests on this device.' }),
      form, msg);
  }

  // ---- downloads ----------------------------------------------------------------------------------------------

  const kv = (k, v) => el('div', {}, el('span', { class: 'k', text: k }), el('span', { class: 'v', text: v }));

  function statusBlock(rel) {
    const s = el('div', { class: 'status' });
    const note = t => s.append(el('span', { class: 'note', text: t }));
    if (!portal) note('Playtest opening soon');
    else if (!catalog && !catalogFailed) note('Checking the latest build…');
    else if (catalogFailed) note('Build info unavailable right now');
    else if (!rel || !rel.available) note('First build in preparation');
    else {
      s.append(kv('Build', String(rel.build).padStart(4, '0') + (rel.version ? ' · ' + rel.version : '')));
      if (rel.published) s.append(kv('Updated', day(rel.published)));
      if (rel.size) s.append(kv('Size', mb(rel.size)));
    }
    return s;
  }

  function renderDownload(box) {
    const slug = box.dataset.download;
    const rel = catalog && catalog[slug];
    const hasBuild = rel && rel.available;
    const unlocked = access && (access.games || []).includes(slug);
    let button;
    if (!portal) button = el('button', { class: 'btn', disabled: true, text: 'Opening soon' });
    else if (!access) button = el('button', { class: 'btn', type: 'button', onclick: focusAccess }, 'Enter access code', arrow());
    else if (!unlocked) button = el('button', { class: 'btn', disabled: true, text: 'Not in your playtests' });
    else if (catalog && !hasBuild) button = el('button', { class: 'btn', disabled: true, text: 'No build yet' });
    else {
      button = el('button', { class: 'btn btn-primary', type: 'button' }, 'Download', arrow());
      button.addEventListener('click', () => download(slug, button));
    }
    const row = el('div', { class: 'row' }, button);
    const g = game(slug);
    if (box.dataset.details !== 'off' && g.page) row.append(el('a', { class: 'btn btn-ghost', href: root + g.page }, 'Full dossier', arrow()));
    const notes = hasBuild && rel.notes && box.dataset.notes !== 'off'
      ? el('details', {}, el('summary', { text: 'In this build' }), el('p', { text: rel.notes })) : null;
    box.replaceChildren(...[statusBlock(rel), row, notes].filter(Boolean));
  }

  function renderDownloads() { document.querySelectorAll('[data-download]').forEach(renderDownload); }

  // ---- dossiers -----------------------------------------------------------------------------------------------

  function stateFor(slug) {
    const rel = catalog && catalog[slug];
    if (catalog && (!rel || !rel.available)) return el('span', { class: 'pill', text: 'In preparation' });
    if (access && (access.games || []).includes(slug)) return el('span', { class: 'pill hot', text: 'Cleared' });
    if (access) return el('span', { class: 'pill', text: 'Restricted' });
    return el('span', { class: 'pill on', text: 'Invite only' });
  }

  function renderStates() {
    document.querySelectorAll('.dossier[data-slug]').forEach(d => {
      const slug = d.dataset.slug, rel = catalog && catalog[slug];
      const meta = d.querySelector('.state');
      meta.replaceChildren(...[
        rel && rel.available ? el('span', { class: 'label', text: `Build ${rel.build}` + (rel.version ? ` · ${rel.version}` : '') }) : null,
        stateFor(slug)].filter(Boolean));
    });
  }

  function renderDossiers(list) {
    const openSlugs = new Set([...list.querySelectorAll('.dossier.is-open')].map(d => d.dataset.slug));
    const first = !list.children.length;
    list.replaceChildren(...GAMES.map((g, i) => {
      const id = 'dossier-' + g.slug;
      const open = first ? i === 0 : openSlugs.has(g.slug);
      const art = el('div', { class: 'art' });
      if (g.art) art.append(el('img', { src: root + g.art, alt: `${g.title} screenshot`, loading: 'lazy' }));
      else { const p = el('div', { class: 'plate' }, el('span', { text: g.title })); p.style.setProperty('--g', g.accent || '#d7262e'); art.append(p); }
      art.append(el('span', { class: 'stamp', text: `FILE ${String(i + 1).padStart(2, '0')} // PLAYTEST` }), el('span', { class: 'reticle' }));
      return el('article', { class: 'dossier' + (open ? ' is-open' : ''), 'data-slug': g.slug },
        el('button', { class: 'tab', type: 'button', 'aria-expanded': String(open), 'aria-controls': id },
          el('span', { class: 'num', text: String(i + 1).padStart(2, '0') }),
          el('span', { class: 't', text: g.title }),
          el('span', { class: 'state' }),
          el('span', { class: 'chev', 'aria-hidden': 'true' })),
        el('div', { class: 'fold', id },
          el('div', { class: 'inner' },
            el('div', { class: 'sheet' },
              el('div', { class: 'leaf' }, art),
              el('div', { class: 'brief' },
                el('div', { class: 'leaf' }, el('p', { class: 'tagline', text: g.tagline || '' })),
                el('div', { class: 'leaf' }, el('div', { class: 'chips' }, ...(g.tags || []).map(t => el('span', { text: t }))), ),
                el('div', { class: 'leaf' }, el('div', { class: 'dl', 'data-download': g.slug }), barcode(g.slug)))))));
    }));
    renderStates();
  }

  function renderAll() {
    document.querySelectorAll('[data-games]').forEach(renderDossiers);
    document.querySelectorAll('[data-access]').forEach(renderAccess);
    renderDownloads();
  }

  renderAll();
  fetchCatalog();
  // Refresh a remembered code quietly: picks up newly granted games and drops a revoked code.
  if (portal && access) checkCode(access.code).then(r => {
    if (!r.ok) { save(null); renderAll(); flash('Your saved access code no longer works.', true); return; }
    save({ ...access, name: r.name, games: r.games });
    renderAll();
  }).catch(() => {});
})();
