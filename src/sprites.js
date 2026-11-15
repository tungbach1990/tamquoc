// The art in the browser, generals and the spirit beasts of their tactics: sheets loaded when first asked
// for, drawn frame by frame, mirrored to face the enemy. A general with no art is drawn as a banner with his name.

import { analyze, mustFlip } from "./spritemeta.js";
import { GENERALS } from "./data/generals.js";
import { BEASTS } from "./data/vfx.js";

const BASE = "assets/";
const cache = new Map();
let manifest = { generals: new Set(), beasts: new Set() };

/** What has art (assets/manifest.json, written by tools/pull.ps1): { generals: [...], beasts: [...] }. */
export async function loadManifest() {
  try {
    const m = await (await fetch(BASE + "manifest.json", { cache: "no-store" })).json();
    manifest = { generals: new Set(m.generals), beasts: new Set(m.beasts) };
  } catch { manifest = { generals: new Set(), beasts: new Set() } }
  return manifest;
}
export const hasArt = (id, kind = "generals") => manifest[kind].has(id);
export const artIds = (kind = "generals") => [...manifest[kind]];
export const portraitUrl = (id) => `${BASE}generals/${id}/portrait.png`;

const image = (src) => new Promise((ok, fail) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => fail(new Error("không tải được " + src)); i.src = src });

/** The sprite for an id (kind: "generals" | "beasts"): { ready, missing, promise } and, once ready, the sheet and what analyze() found. */
export function sprite(id, kind = "generals") {
  let s = cache.get(`${kind}/${id}`);
  if (s) return s;
  s = { id, kind, ready: false, missing: !hasArt(id, kind), promise: null };
  cache.set(`${kind}/${id}`, s);
  s.promise = s.missing ? Promise.resolve(s) : (async () => {
    try {
      const dir = `${BASE}${kind}/${id}/`;
      const [json, img] = await Promise.all([fetch(dir + "sheet.json").then((r) => r.json()), image(dir + "sheet.png")]);
      const c = document.createElement("canvas");
      c.width = img.width; c.height = img.height;
      const g = c.getContext("2d", { willReadFrequently: true });
      g.drawImage(img, 0, 0);
      Object.assign(s, analyze(g.getImageData(0, 0, c.width, c.height).data, c.width, json), { img, ready: true });
      const forced = (kind === "beasts" ? BEASTS : GENERALS)[id]?.facing;
      if (forced) s.facing = forced;
    } catch (e) { s.missing = true; console.warn(`sprite ${kind}/${id}:`, e.message) }
    return s;
  })();
  return s;
}
export const preload = (ids, kind = "generals") => Promise.all(ids.map((id) => sprite(id, kind).promise));

// an animation the sheet lacks borrows another
const BORROW = { skill01: ["skill02", "attack"], attack: ["skill01"], walk: ["idle"], die: [] };
/** The animation to play for a wanted one, or null (only "die" can be null: the caller fades the figure). */
export function animOf(s, want) {
  if (s.tags[want]) return want;
  // some rigs name their skill their own way (jls_skill, xy_skill_02)
  if (want === "skill01") { const own = Object.keys(s.tags).find((n) => /skill/i.test(n)); if (own) return own }
  for (const n of BORROW[want] ?? []) if (s.tags[n]) return n;
  return want === "die" ? null : s.tags.idle ? "idle" : Object.keys(s.tags)[0];
}
export function animLength(s, name) {
  const t = s.tags[name]; let ms = 0;
  for (let i = t.from; i <= t.to; i++) ms += s.frames[i].dur;
  return ms;
}
function frameAt(s, name, ms, loop) {
  const t = s.tags[name], total = animLength(s, name);
  let at = loop ? ms % total : Math.min(ms, total - 1);
  for (let i = t.from; i <= t.to; i++) { at -= s.frames[i].dur; if (at < 0) return s.frames[i] }
  return s.frames[t.to];
}

/** Draw a ready sprite with its feet at (x, y). */
export function drawSprite(ctx, s, name, ms, x, y, { scale = 1, faceRight = true, loop = true, alpha = 1 } = {}) {
  const f = frameAt(s, name, ms, loop), flip = mustFlip(s.facing, faceRight);
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y);
  ctx.scale(flip ? -scale : scale, scale);
  ctx.drawImage(s.img, f.x, f.y, f.w, f.h, -s.ax, -s.ay, f.w, f.h);
  ctx.restore();
}

export const KINGDOM_COLOR = { thuc: "#3f9b57", nguy: "#3b6fc4", ngo: "#c8463c", than: "#d9a520", none: "#7d6a8f" };
/** A general with no art: a banner in his kingdom's color, his name on it. */
export function drawPlaceholder(ctx, g, x, y, { scale = 1, alpha = 1 } = {}) {
  const w = 44 * scale, h = 84 * scale;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = "#3a2a1c"; ctx.fillRect(x - 2 * scale, y - h - 8 * scale, 4 * scale, h + 8 * scale);
  ctx.fillStyle = KINGDOM_COLOR[g.k]; ctx.fillRect(x - w / 2, y - h, w, h * 0.78);
  ctx.strokeStyle = "#f3dfa0"; ctx.lineWidth = 2 * scale; ctx.strokeRect(x - w / 2, y - h, w, h * 0.78);
  ctx.fillStyle = "#fff8e0"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.font = `bold ${13 * scale}px system-ui, sans-serif`;
  g.name.split(" ").slice(-3).forEach((word, i, all) => ctx.fillText(word, x, y - h + (h * 0.78) * (i + 1) / (all.length + 1)));
  ctx.restore();
}
