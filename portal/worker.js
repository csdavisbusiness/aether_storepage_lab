// Squishtech Industries playtest portal.
//
// The one public door to the private build repositories. The landing page talks to it; the games themselves keep
// using their own relays for updates. It holds a single read-only GitHub token (a secret, never sent anywhere but
// GitHub) and opens a download only for a valid tester access code.
//
//   GET  /                     {ok:true}: a health check
//   GET  /catalog              every game's newest build: {games:[{slug, build, version, published, size, notes}]}
//                              Public: it says what exists, never how to fetch it.
//   POST /access   {code}      {ok, name, games:[slug...]} for a valid code, 403 otherwise
//   POST /download/<slug>      form field `code`. 303 to GitHub's own short-lived link for that game's newest zip,
//                              so the file comes straight from GitHub's storage, and logs who took which build.
//                              Each code may download each game MAX_DOWNLOADS_PER_GAME times; then it gets a
//                              polite refusal until `testers.cmd reset` clears its count.
//
// Access codes live in the CODES KV namespace under `code:<sha256 of the normalised code>`, so the namespace never
// holds a usable code. tools: portal/testers.ps1 adds, lists and revokes them and reads the download log.

const MEMO_MS = 60_000;
let memo = { at: 0, data: null };

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    const cors = corsHeaders(request.headers.get("origin"), env);
    try {
      if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
      if (path === "/" && request.method === "GET") return json({ ok: true, service: "squishtech-playtest-portal" }, 200, cors);
      if (path === "/catalog" && request.method === "GET")
        return json(await catalog(env), 200, { ...cors, "cache-control": "public, max-age=60" });
      if (path === "/access" && request.method === "POST") {
        const t = await tester(env, (await readBody(request)).code);
        if (!t) return json({ ok: false, error: "That access code isn't valid." }, 403, cors);
        return json({ ok: true, name: t.name, games: allowedGames(env, t) }, 200, cors);
      }
      const m = path.match(/^\/download\/([a-z0-9-]+)$/);
      if (m && request.method === "POST") return await download(request, env, ctx, m[1]);
      return json({ ok: false, error: "not found" }, 404, cors);
    } catch (err) {
      console.error(err && err.stack || String(err));
      return json({ ok: false, error: "Something went wrong on our side. Try again in a minute." }, 502, cors);
    }
  },
};

// ---- games and releases --------------------------------------------------------------------------------------

function games(env) {
  const g = typeof env.GAMES === "string" ? JSON.parse(env.GAMES) : env.GAMES;
  return g || {};
}

async function catalog(env) {
  if (memo.data && Date.now() - memo.at < MEMO_MS) return memo.data;
  const list = await Promise.all(Object.entries(games(env)).map(async ([slug, repo]) => {
    const rel = await latestRelease(env, repo);
    if (!rel) return { slug, available: false };
    const zip = (rel.assets || []).find(a => /\.zip$/i.test(a.name));
    return {
      slug,
      available: !!zip,
      build: buildNumber(rel.tag_name),
      version: versionOf(rel),
      published: rel.published_at,
      size: zip ? zip.size : null,
      notes: notesOf(rel.body),
    };
  }));
  memo = { at: Date.now(), data: { ok: true, games: list } };
  return memo.data;
}

async function latestRelease(env, repo) {
  const res = await gh(env, `/repos/${repo}/releases/latest`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub ${res.status} on ${repo}${res.status === 401 ? " (check the GITHUB_TOKEN secret)" : ""}`);
  return res.json();
}

function gh(env, path, extra = {}) {
  return fetch("https://api.github.com" + path, {
    ...extra,
    headers: {
      authorization: `Bearer ${env.GITHUB_TOKEN}`,
      accept: "application/vnd.github+json",
      "user-agent": "squishtech-playtest-portal",
      "x-github-api-version": "2022-11-28",
      ...(extra.headers || {}),
    },
  });
}

const buildNumber = tag => { const m = /build-(\d+)/.exec(tag || ""); return m ? Number(m[1]) : null; };

function versionOf(rel) {
  const m = /\bv\d+(?:\.\d+)+\b/.exec(`${rel.name || ""}\n${(rel.body || "").split("\n")[0]}`);
  return m ? m[0] : null;
}

// The release notes, less the machine lines the ship scripts add and a first line that is only the version.
function notesOf(body) {
  const lines = String(body || "").replace(/\r/g, "").split("\n")
    .filter(l => !/^\s*(sha256|commit|branch)\s*:/i.test(l));
  while (lines.length && (!lines[0].trim() || /^\s*v\d+(\.\d+)+\s*$/.test(lines[0]))) lines.shift();
  const text = lines.join("\n").trim();
  return text.length > 600 ? text.slice(0, 597).trimEnd() + "…" : text;
}

// ---- testers --------------------------------------------------------------------------------------------------

const normalise = code => String(code || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}

async function tester(env, code) {
  const c = normalise(code);
  if (c.length < 10 || c.length > 40) return null;
  const hash = await sha256(c);
  const rec = await env.CODES.get(`code:${hash}`, "json");
  return rec && !rec.revoked ? { ...rec, hash } : null;
}

// How many times each game has been downloaded with one code: `count:<hash>` = {slug: n}. The same numbers ride in
// the key's metadata, with the tester's name, so testers.ps1 can list them without reading every key.
const limitOf = env => { const n = parseInt(env.MAX_DOWNLOADS_PER_GAME, 10); return n > 0 ? n : Infinity; };
const countsOf = async (env, t) => (await env.CODES.get(`count:${t.hash}`, "json")) || {};
async function addDownload(env, t, counts, slug) {
  const next = { ...counts, [slug]: (counts[slug] || 0) + 1 };
  await env.CODES.put(`count:${t.hash}`, JSON.stringify(next), { metadata: { name: t.name, ...next } });
}

function allowedGames(env, t) {
  const all = Object.keys(games(env));
  const mine = Array.isArray(t.games) ? t.games : ["*"];
  return mine.includes("*") ? all : all.filter(s => mine.includes(s));
}

async function download(request, env, ctx, slug) {
  const t = await tester(env, (await readBody(request)).code);
  if (!t) return page(env, 403, "That access code isn't valid", "Check the code you were sent, or ask us for a new one.");
  const repo = games(env)[slug];
  if (!repo) return page(env, 404, "No such playtest", "That game isn't on the list.");
  if (!allowedGames(env, t).includes(slug))
    return page(env, 403, "Not on your list yet", "Your code doesn't include this playtest. Ask us if you'd like to join it.");
  const rel = await latestRelease(env, repo);
  const zip = rel && (rel.assets || []).find(a => /\.zip$/i.test(a.name));
  if (!zip) return page(env, 404, "No build yet", "There's no build of this game to download yet. Check back soon.");

  // First installs only come through here (games update through their own relays), so a code that keeps
  // downloading the same game is most likely being shared.
  const counts = await countsOf(env, t);
  if ((counts[slug] || 0) >= limitOf(env)) {
    console.log(JSON.stringify({ event: "limit", tester: t.name, game: slug, count: counts[slug] }));
    return page(env, 429, "This code has reached its download limit",
      "Your code has already downloaded this playtest the most times it can. Once installed, the game keeps itself up to date, so you shouldn't need it again. If you do, contact us and we'll reset it.");
  }

  const res = await gh(env, `/repos/${repo}/releases/assets/${zip.id}`, {
    headers: { accept: "application/octet-stream" },
    redirect: "manual",
  });
  const location = res.headers.get("location");
  if (!location) throw new Error(`GitHub gave no download link for ${repo} asset ${zip.id} (${res.status})`);

  const build = buildNumber(rel.tag_name);
  await addDownload(env, t, counts, slug);
  console.log(JSON.stringify({ event: "download", tester: t.name, game: slug, build, count: (counts[slug] || 0) + 1 }));
  ctx.waitUntil(env.CODES.put(`log:${new Date().toISOString()}:${crypto.randomUUID().slice(0, 8)}`, "", {
    expirationTtl: 90 * 24 * 3600,
    metadata: { tester: t.name, game: slug, build },
  }));
  return new Response(null, { status: 303, headers: { location, "cache-control": "no-store" } });
}

// ---- plumbing -------------------------------------------------------------------------------------------------

async function readBody(request) {
  const type = request.headers.get("content-type") || "";
  try {
    if (type.includes("application/x-www-form-urlencoded") || type.includes("multipart/form-data"))
      return Object.fromEntries(await request.formData());
    return JSON.parse(await request.text() || "{}");
  } catch {
    return {};
  }
}

function corsHeaders(origin, env) {
  const allowed = String(env.ALLOWED_ORIGINS || "*").split(",").map(s => s.trim()).filter(Boolean);
  const h = { "access-control-allow-methods": "GET, POST, OPTIONS", "access-control-allow-headers": "content-type", vary: "origin" };
  if (allowed.includes("*")) h["access-control-allow-origin"] = "*";
  else if (origin && allowed.includes(origin)) h["access-control-allow-origin"] = origin;
  return h;
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", ...headers } });
}

// A plain page for the form-post download path, where the browser shows the response itself.
function page(env, status, title, text) {
  const esc = s => String(s).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
  const back = env.SITE_URL ? `<p><a href="${esc(env.SITE_URL)}">Back to the playtests</a></p>` : "";
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} · Squishtech Playtests</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0e1318;color:#e6edf2;font:16px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif;padding:16px}main{max-width:460px}h1{font-size:1.4rem;margin:0 0 8px}p{color:#9fb0be}a{color:#f2c14e}</style></head><body><main><h1>${esc(title)}</h1><p>${esc(text)}</p>${back}</main></body></html>`;
  return new Response(html, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}
