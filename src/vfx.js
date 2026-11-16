// A tactic's show, drawn smooth on the battle canvas: first the cut-in (the general's banner sliding across),
// then the effect of its kind. Everything here is a pure function of time: nothing is remembered between
// frames, so a tactic can be replayed, skipped or tested on a fake canvas.
//
// env (built by the view for one tactic):
//   W, H            the canvas, in its own units
//   cfg             the general's entry in data/vfx.js: { fx, c, c2, ... }
//   who, tactic     the names shown in the cut-in
//   dir             +1 when the caster stands on the left and strikes rightward, -1 the other way
//   caster          { x, y, tall, s }   feet, drawn height, sprite
//   targets         [{ x, y, tall }]    whom it lands on (the caster's own line for a healing tactic)
//   heal            true for a healing tactic
//   beast           the spirit beast's sprite, or null
//   now             a running clock in ms, for sprite animation and flicker

import { drawSprite, animOf } from "./sprites.js";
import { mustFlip } from "./spritemeta.js";
import { BEASTS } from "./data/vfx.js";

/** Where in the effect (0..1) the blow lands: the view applies the damage then. */
export const HIT = 0.62;
/** How long a kind of effect plays, in ms at normal speed: the ones with a creature or a long build-up get more. */
export const effectMs = (cfg) => ({ beast: 1750, dragon: 3400, storm: 1850, grace: 1700, wheels: 1500 })[cfg.fx] ?? 1200;
/** When in the effect (0..1) the general's own strike animation starts: at once, except where he first calls
 *  something up and strikes later (Guan Yu holds his blade up while the dragon wheels, then cuts). */
export const castAt = (cfg) => ({ dragon: 0.46 })[cfg.fx] ?? 0;

const TAU = Math.PI * 2;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a, b, k) => a + (b - a) * k;
/** 0 before a, 1 after b, linear between. */
const span = (k, a, b) => clamp01((k - a) / (b - a));
const easeOut = (k) => 1 - (1 - k) * (1 - k) * (1 - k);
const easeIn = (k) => k * k;
/** A fixed "random" number in [0, 1) for particle i: the same every frame. */
const rnd = (i, salt = 0) => { const v = Math.sin(i * 127.1 + salt * 311.7 + 1.3) * 43758.5453; return v - Math.floor(v) };
const channels = (hex) => { const n = parseInt((hex.length === 4 ? hex.replace(/#(.)(.)(.)/, "#$1$1$2$2$3$3") : hex).slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255] };
// a NaN alpha draws nothing; it must not make a bad colour, which a canvas throws on
const rgba = (hex, a) => { const [r, g, b] = channels(hex); return `rgba(${r},${g},${b},${(a > 0 ? Math.min(1, a) : 0).toFixed(3)})` };
/** The colour made darker (m < 1) or lighter (m > 1). */
const tone = (hex, m) => { const [r, g, b] = channels(hex).map((v) => Math.max(0, Math.min(255, Math.round(v * m)))); return `rgb(${r},${g},${b})` };

// ---------------- brushes ----------------
function lit(ctx, draw) { ctx.save(); ctx.globalCompositeOperation = "lighter"; draw(); ctx.restore() }
function glow(ctx, x, y, r, color, a) {
  if (a <= 0 || r <= 0) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(color, a)); g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
}
function ring(ctx, x, y, r, width, color, a, squash = 1) {
  if (a <= 0 || r <= 0) return;
  ctx.save(); ctx.translate(x, y); ctx.scale(1, squash);
  ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU);
  ctx.lineWidth = width; ctx.strokeStyle = rgba(color, a); ctx.stroke(); ctx.restore();
}
function dot(ctx, x, y, r, fill) { if (r <= 0) return; ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill() }
/** A line that is bright at its head (x1, y1) and fades to nothing at its tail. */
function streak(ctx, x0, y0, x1, y1, width, color, a) {
  if (a <= 0) return;
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, rgba(color, 0)); g.addColorStop(1, rgba(color, a));
  ctx.strokeStyle = g; ctx.lineWidth = width; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
}
/** A blade's arc: thick in the middle, sharp at both tips, glowing. rot: where its middle points; open: its angle. */
function crescent(ctx, x, y, r, rot, open, thick, color, core, a) {
  if (a <= 0 || open <= 0.01) return;
  const a0 = rot - open / 2, a1 = rot + open / 2;
  ctx.save();
  ctx.shadowColor = color; ctx.shadowBlur = 22;
  ctx.beginPath(); ctx.arc(x, y, r, a0, a1);
  ctx.quadraticCurveTo(x + Math.cos(rot) * (r - thick * 2), y + Math.sin(rot) * (r - thick * 2), x + Math.cos(a0) * r, y + Math.sin(a0) * r);
  ctx.fillStyle = rgba(color, a); ctx.fill();
  ctx.beginPath(); ctx.arc(x, y, r - 1, a0 + open * 0.08, a1 - open * 0.08);
  ctx.lineWidth = Math.max(2, thick * 0.28); ctx.lineCap = "round"; ctx.strokeStyle = rgba(core, a); ctx.stroke();
  ctx.restore();
}
/** A jagged bolt from (x0, y0) to (x1, y1). */
function bolt(ctx, x0, y0, x1, y1, seed, color, core, width, a) {
  if (a <= 0) return;
  const n = 9, dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1, px = -dy / len, py = dx / len;
  const path = () => {
    ctx.beginPath(); ctx.moveTo(x0, y0);
    for (let i = 1; i < n; i++) { const off = (rnd(i, seed) - 0.5) * len * 0.16; ctx.lineTo(x0 + dx * i / n + px * off, y0 + dy * i / n + py * off) }
    ctx.lineTo(x1, y1);
  };
  ctx.save(); ctx.lineJoin = "round"; ctx.lineCap = "round";
  ctx.shadowColor = color; ctx.shadowBlur = 20;
  path(); ctx.lineWidth = width * 2.4; ctx.strokeStyle = rgba(color, a * 0.7); ctx.stroke();
  path(); ctx.lineWidth = width; ctx.strokeStyle = rgba(core, a); ctx.stroke();
  ctx.restore();
}
/** A tongue of flame standing on (x, y). */
function flame(ctx, x, y, h, w, color, core, a, sway) {
  if (a <= 0 || h <= 1) return;
  const g = ctx.createLinearGradient(x, y, x, y - h);
  g.addColorStop(0, rgba(core, a)); g.addColorStop(0.45, rgba(color, a * 0.85)); g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - w / 2, y);
  ctx.quadraticCurveTo(x - w * 0.55, y - h * 0.5, x + sway, y - h);
  ctx.quadraticCurveTo(x + w * 0.55, y - h * 0.5, x + w / 2, y);
  ctx.quadraticCurveTo(x, y + w * 0.3, x - w / 2, y); ctx.fill();
}
function words(ctx, str, x, y, size, color, edge, a, maxWidth, face = 'system-ui, "Segoe UI", sans-serif') {
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha *= a;
  ctx.font = `900 ${size}px ${face}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.lineJoin = "round"; ctx.lineWidth = Math.max(3, size / 6); ctx.strokeStyle = edge;
  ctx.shadowColor = edge; ctx.shadowBlur = size / 3;
  ctx.strokeText(str, x, y, maxWidth); ctx.shadowBlur = 0; ctx.fillStyle = color; ctx.fillText(str, x, y, maxWidth);
  ctx.restore();
}
/** The eight-trigram array lying on the ground: two rings, an octagon, the trigrams, yin and yang at the heart. */
function bagua(ctx, x, y, r, turn, a, c, c2) {
  if (a <= 0 || r <= 0) return;
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  ctx.translate(x, y); ctx.scale(1, 0.4); ctx.rotate(turn);
  ctx.shadowColor = c; ctx.shadowBlur = 18; ctx.strokeStyle = rgba(c2, a); ctx.fillStyle = rgba(c2, a);
  ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
  ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, r * 0.9, 0, TAU); ctx.stroke();
  ctx.beginPath(); for (let j = 0; j <= 8; j++) { const ang = j * TAU / 8 + TAU / 16; ctx[j ? "lineTo" : "moveTo"](Math.cos(ang) * r * 0.58, Math.sin(ang) * r * 0.58) } ctx.stroke();
  // the eight trigrams: three bars each, whole or broken
  for (let j = 0; j < 8; j++) {
    ctx.save(); ctx.rotate(j * TAU / 8);
    for (let b = 0; b < 3; b++) { const by = -r * 0.66 - b * r * 0.07, w = r * 0.2, h = r * 0.035; if ((j >> b) & 1) ctx.fillRect(-w / 2, by, w, h); else { ctx.fillRect(-w / 2, by, w * 0.4, h); ctx.fillRect(w * 0.1, by, w * 0.4, h) } }
    ctx.restore();
  }
  const core = r * 0.3;
  ctx.beginPath(); ctx.arc(0, 0, core, 0, TAU); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, core, -Math.PI / 2, Math.PI / 2); ctx.arc(0, core / 2, core / 2, Math.PI / 2, -Math.PI / 2, true); ctx.arc(0, -core / 2, core / 2, Math.PI / 2, -Math.PI / 2); ctx.fill();
  ctx.restore();
}
/** The caster himself, enormous, looming behind his own line. */
function giant(ctx, env, a, anim = "skill01") {
  const { cfg, dir, caster } = env;
  lit(ctx, () => glow(ctx, caster.x, caster.y - 110, 230, cfg.c, 0.5 * a));
  if (!caster.s?.ready) return;
  const shake = Math.sin(env.now / 18) * 5 * a, grow = 1 + 0.08 * Math.sin(env.now / 60);
  drawSprite(ctx, caster.s, animOf(caster.s, anim), env.now, caster.x - dir * 34 + shake, caster.y + 190, { scale: 430 / caster.s.h * grow, faceRight: dir > 0, alpha: 0.62 * a, loop: true });
}
/** A side-on figure in flight, its middle at (x, y), heading along (vx, vy). It leans into its path (lean: how
 *  much, 0..1). face: +1 or -1 keeps it looking that way; without it the figure turns with its heading,
 *  squeezing flat as it comes about, the way a ribbon turns over. */
function fly(ctx, s, anim, ms, x, y, vx, vy, size, alpha, { lean = 1, face = 0 } = {}) {
  const speed = Math.hypot(vx, vy) || 1, turn = Math.max(-1, Math.min(1, vx / speed * 2.5));
  const sx = face || (Math.abs(turn) < 0.2 ? (turn < 0 ? -0.2 : 0.2) : turn);
  ctx.save(); ctx.translate(x, y); ctx.rotate(Math.atan2(vy, Math.abs(vx)) * lean * Math.sign(sx)); ctx.scale(sx, 1);
  // drawSprite puts the feet where it is told: tell it where they fall when the figure's middle is at the origin
  drawSprite(ctx, s, anim, ms, (s.cx - s.ax) * size * (mustFlip(s.facing, true) ? 1 : -1), (s.ay - s.cy) * size, { scale: size, faceRight: true, alpha });
  ctx.restore();
}
/** A smooth curve through the points (Catmull-Rom): u = 0 is the first point, u = 1 the second, and so on. */
function spline(pts, u) {
  const n = pts.length - 1, i = Math.max(0, Math.min(n - 1, Math.floor(u))), t = clamp01(u - i);
  const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n, i + 2)];
  const at = (a, b, c, d) => 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (3 * b - a - 3 * c + d) * t * t * t);
  return { x: at(p0.x, p1.x, p2.x, p3.x), y: at(p0.y, p1.y, p2.y, p3.y) };
}
/** The blow landing on one target: a flash, a ring racing out along the ground, sparks. q: 0..1 since the hit. */
function impact(ctx, q, x, y, tall, c, c2, size = 1) {
  if (q <= 0 || q >= 1) return;
  const chest = y - tall * 0.5;
  lit(ctx, () => {
    glow(ctx, x, chest, (50 + 60 * q) * size, c2, (1 - q) * 0.95);
    glow(ctx, x, chest, 90 * size, c, (1 - q) * 0.5);
    ring(ctx, x, y, (18 + 105 * easeOut(q)) * size, 5 * (1 - q) + 1, c2, (1 - q) * 0.9, 0.38);
    for (let i = 0; i < 9; i++) {
      const ang = i * TAU / 9 + rnd(i, 7), r0 = (14 + 46 * easeOut(q)) * size, r1 = r0 + (16 + 26 * rnd(i, 3)) * (1 - q) * size;
      streak(ctx, x + Math.cos(ang) * r0, chest + Math.sin(ang) * r0, x + Math.cos(ang) * r1, chest + Math.sin(ang) * r1, 3, c2, 1 - q);
    }
  });
}
const impacts = (ctx, k, env, size = 1) => env.targets.forEach((t, i) => impact(ctx, span(k, HIT + i * 0.015, HIT + 0.3 + i * 0.015), t.x, t.y, t.tall, env.cfg.c, env.cfg.c2, size));
/** Lightning down on every target at the hit, an echo just after, and the whole field flashing white. */
function strikes(ctx, k, env, c, c2) {
  env.targets.forEach((t, i) => {
    for (const [when, wide, off] of [[HIT, 5, 0], [HIT + 0.09, 3, 26]]) {
      const q = (k - when) / 0.11;
      if (q < 0 || q > 1) continue;
      lit(ctx, () => {
        const sx = t.x + (rnd(i, 5) - 0.5) * 110 + off;
        bolt(ctx, sx, 60, t.x, t.y - 6, i * 3 + (when === HIT ? 0 : 1) + Math.floor(q * 3), c, "#ffffff", wide, 1 - q * 0.6);
        bolt(ctx, lerp(sx, t.x, 0.45), lerp(60, t.y, 0.45), t.x + (rnd(i, 6) - 0.5) * 120, t.y - 90, i + 9, c, c2, 2, (1 - q) * 0.8);
      });
    }
  });
  const flash = span(k, HIT, HIT + 0.1);
  if (flash > 0 && flash < 1) { ctx.fillStyle = `rgba(255,255,255,${(0.5 * (1 - flash)).toFixed(3)})`; ctx.fillRect(0, 0, env.W, env.H) }
}

/** A pillar of light standing up on every target at the hit. */
function pillars(ctx, k, env) {
  const { cfg } = env;
  lit(ctx, () => env.targets.forEach((t, i) => {
    const q = span(k, HIT - 0.02 + i * 0.02, HIT + 0.3 + i * 0.02);
    if (q <= 0 || q >= 1) return;
    const h = 300 * easeOut(Math.min(1, q * 3)), w = 44 * (1 - q * 0.5), g = ctx.createLinearGradient(t.x, t.y, t.x, t.y - h);
    g.addColorStop(0, rgba(cfg.c2, 1 - q)); g.addColorStop(1, rgba(cfg.c, 0));
    ctx.fillStyle = g; ctx.fillRect(t.x - w / 2, t.y - h, w, h);
    ctx.fillStyle = rgba("#ffffff", (1 - q) * 0.9); ctx.fillRect(t.x - w / 6, t.y - h, w / 3, h);
  }));
}

/** The middle of the targets and how far they spread. */
function field(env) {
  const xs = env.targets.map((t) => t.x), ys = env.targets.map((t) => t.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  return { x0, x1, y0, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0, tall: env.targets[0]?.tall ?? 100 };
}
/** A runner's place at time k: gathers speed from `from` into `mid` at the hit, then slows away to `to`. */
function run(k, from, mid, to, start = 0.12) {
  if (k <= HIT) { const u = easeIn(span(k, start, HIT)); return { x: lerp(from.x, mid.x, u), y: lerp(from.y, mid.y, u), u } }
  const u = easeOut(span(k, HIT, 0.96));
  return { x: lerp(mid.x, to.x, u), y: lerp(mid.y, to.y, u), u: 1 };
}

// ---------------- the cut-in ----------------
/** The general's banner: a slanted band slides in from his side with his figure and the tactic's name. k: 0..1. */
export function drawCutIn(ctx, k, env) {
  const { W, cfg, dir, caster } = env, a = span(k, 0, 0.18) * (1 - span(k, 0.84, 1));
  if (a <= 0) return;
  const slide = (1 - easeOut(span(k, 0, 0.3))) * -dir * W, top = 150, bottom = 330, lean = 46;
  ctx.save();
  ctx.fillStyle = `rgba(0,0,0,${(0.35 * a).toFixed(3)})`; ctx.fillRect(0, 0, W, env.H);
  ctx.globalAlpha = a;
  ctx.translate(slide, 0);
  ctx.beginPath(); ctx.moveTo(-lean, bottom); ctx.lineTo(lean, top); ctx.lineTo(W + lean, top); ctx.lineTo(W - lean, bottom); ctx.closePath();
  const g = ctx.createLinearGradient(dir > 0 ? 0 : W, 0, dir > 0 ? W : 0, 0);
  g.addColorStop(0, rgba(cfg.c, 0.95)); g.addColorStop(0.55, "rgba(18,10,14,0.92)"); g.addColorStop(1, "rgba(8,4,8,0.85)");
  ctx.fillStyle = g; ctx.fill();
  ctx.save(); ctx.clip();
  // speed lines racing back past him
  for (let i = 0; i < 16; i++) {
    const y = top + 8 + rnd(i, 1) * (bottom - top - 16), len = 60 + rnd(i, 2) * 120;
    const x = ((rnd(i, 3) * W - dir * (k * 1400 + i * 37)) % (W + len) + (W + len)) % (W + len) - len / 2;
    streak(ctx, x + dir * len, y, x, y, 2 + rnd(i, 4) * 2, cfg.c2, 0.5);
  }
  if (caster.s?.ready) {
    lit(ctx, () => glow(ctx, W / 2 - dir * 150, 250, 150, cfg.c2, 0.35));
    drawSprite(ctx, caster.s, animOf(caster.s, "idle"), env.now, W / 2 - dir * 150 + dir * 14 * span(k, 0, 1), bottom + 30, { scale: 250 / caster.s.h, faceRight: dir > 0 });
  }
  ctx.restore();
  ctx.strokeStyle = rgba(cfg.c2, 0.95); ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(lean, top); ctx.lineTo(W + lean, top); ctx.moveTo(-lean, bottom); ctx.lineTo(W - lean, bottom); ctx.stroke();
  const tx = W / 2 + dir * 95 + dir * (1 - easeOut(span(k, 0.08, 0.4))) * 90;
  words(ctx, env.who, tx, 196, 17, "#fff3d6", "rgba(0,0,0,.8)", span(k, 0.1, 0.3));
  words(ctx, env.tactic, tx, 244, 40, cfg.c2, "rgba(0,0,0,.85)", span(k, 0.12, 0.35), 320);
  ctx.restore();
}

// ---------------- the kinds ----------------
const KINDS = {
  /** A spirit beast is called up between the armies, stands and roars so that it is seen, then springs on the targets. */
  beast(ctx, layer, k, env) {
    const { cfg, dir, caster, beast, W, H } = env, f = field(env), flies = cfg.move === "dive";
    const scale = beast?.ready ? Math.min(175 / beast.h, 260 / beast.w) : 1, tall = beast?.ready ? beast.h * scale : 150;
    const stand = { x: W / 2 - dir * 22, y: Math.min(H - 24, (caster.y + f.cy) / 2 + 28) - (flies ? 90 : 0) };
    const prey = { x: f.cx - dir * 12, y: f.cy + 8 - (flies ? f.tall * 0.3 : 0) };
    const SPRING = 0.42, leap = easeIn(span(k, SPRING, HIT)), shown = span(k, 0.05, 0.13) * (1 - span(k, 0.86, 0.98));
    const hop = flies ? Math.sin(env.now / 170) * 7 : -Math.sin(leap * Math.PI) * 46;        // a bird bobs; a beast leaps in an arc
    const p = { x: lerp(stand.x, prey.x, leap), y: lerp(stand.y, prey.y, leap) + hop };
    if (layer === "back") {
      lit(ctx, () => {
        const call = span(k, 0, 0.2);
        if (call < 1) glow(ctx, caster.x, caster.y - caster.tall * 0.5, 30 + 70 * call, cfg.c, (1 - call) * 0.9);
        // the ground it is called up on
        for (const [from, to] of [[0.04, 0.3], [0.16, 0.42]]) { const q = span(k, from, to); if (q > 0 && q < 1) ring(ctx, stand.x, stand.y + (flies ? 90 : 0), 24 + 190 * easeOut(q), 7 * (1 - q) + 1, cfg.c2, 1 - q, 0.38) }
        ctx.save(); ctx.translate(p.x, (flies ? p.y + 90 : lerp(stand.y, prey.y, leap))); ctx.scale(1, 0.34); glow(ctx, 0, 0, 120, cfg.c, 0.55 * shown); ctx.restore();
      });
      return;
    }
    if (shown > 0) {
      lit(ctx, () => glow(ctx, p.x, p.y - tall * 0.5, tall * 0.85, cfg.c, 0.32 * shown));
      if (beast?.ready) {
        const anim = k >= HIT - 0.07 && beast.tags.attack ? "attack" : k >= SPRING ? animOf(beast, "walk") : animOf(beast, "idle");
        const size = scale * (k < SPRING ? 1 + 0.035 * Math.sin(env.now / 75) : 1);       // it swells as it roars
        // only the spring leaves a trail: standing, it must be seen plainly
        if (leap > 0 && leap < 1) for (let i = 2; i >= 1; i--) { const back = easeIn(span(k - i * 0.022, SPRING, HIT)); drawSprite(ctx, beast, anim, env.now, lerp(stand.x, prey.x, back), lerp(stand.y, prey.y, back) - (flies ? 0 : Math.sin(back * Math.PI) * 46), { scale, faceRight: dir > 0, alpha: shown * (0.34 - i * 0.1) }) }
        drawSprite(ctx, beast, anim, env.now, p.x, p.y, { scale: size, faceRight: dir > 0, alpha: shown });
      } else lit(ctx, () => { glow(ctx, p.x, p.y - 60, 70, cfg.c2, shown); glow(ctx, p.x, p.y - 60, 26, "#ffffff", shown) });   // no art: a ball of light
      lit(ctx, () => { for (let i = 0; i < 14; i++) { const ang = rnd(i, 1) * TAU + env.now / 700, r = tall * (0.35 + 0.4 * rnd(i, 2)); glow(ctx, p.x + Math.cos(ang) * r, p.y - tall * 0.5 + Math.sin(ang) * r * 0.7, 4 + rnd(i, 3) * 5, i % 3 ? cfg.c : cfg.c2, shown * 0.8) } });
      const name = BEASTS[cfg.beast]?.name;
      if (name) words(ctx, name, stand.x, stand.y + (flies ? 104 : 20), 19, cfg.c2, "rgba(0,0,0,.85)", span(k, 0.1, 0.18) * (1 - span(k, SPRING - 0.06, SPRING)));
    }
    impacts(ctx, k, env, 1.3);
  },

  /** The head leads; the articulated body follows its flight, rather than rotating a rigid sprite. */
  dragon(ctx, layer, k, env) {
    const { cfg, dir, caster, W, H } = env, RISE = 0.07, DIVE = 0.54, EXIT = 0.76, TURNS = 1;
    const hand = { x: caster.x + dir * 8, y: caster.y - caster.tall * 0.62 }, tip = { x: hand.x, y: hand.y - 74 };   // the blade, held straight up
    const C = { x: W / 2, y: 124 }, RX = 178, RY = 50;                              // the ring it flies in the sky
    // the enemy's column, in the order it will be run through
    const marks = [...env.targets].sort((a, b) => a.y - b.y || (a.x - b.x) * dir).map((t) => ({ x: t.x, y: t.y - t.tall * 0.5, t }));
    const n = marks.length, first = marks[0], last = marks[n - 1], passes = (i) => HIT + (EXIT - HIT) * i / n;
    // it wheels over the far side toward the enemy, and leaves the ring there, a little short of the column
    const phiD = -Math.acos(Math.max(-0.9, Math.min(0.95, ((first.x - C.x) * dir - 50) / RX)));
    const wheel = (kk) => {
      const e = easeOut(span(kk, RISE, RISE + 0.16)), ph = phiD - TURNS * TAU * (DIVE - kk) / (DIVE - RISE);   // e: it spirals up out of the blade
      return { x: lerp(tip.x, C.x, e) + dir * RX * e * Math.cos(ph), y: lerp(tip.y, C.y, e) + RY * e * Math.sin(ph), near: (Math.sin(ph) + 1) / 2, e };
    };
    const P0 = wheel(DIVE), lead = n > 1 ? { x: last.x - marks[n - 2].x, y: last.y - marks[n - 2].y } : { x: dir * 40, y: 280 }, ll = Math.hypot(lead.x, lead.y) || 1;
    const road = [P0, ...marks, { x: last.x + lead.x / ll * 300, y: last.y + lead.y / ll * 300 }];             // down through each of them, and out the far end
    const along = (kk) => { if (kk > HIT) return 1 + n * span(kk, HIT, EXIT); const s = span(kk, DIVE, HIT); return s * (0.4 + 0.6 * s) };
    const at = (kk) => (kk < DIVE ? wheel(kk) : spline(road, along(kk)));
    const full = 1;
    const sizeAt = (kk) => { if (kk >= DIVE) return lerp(0.68 + 0.24 * P0.near, 1.12, easeIn(span(kk, DIVE, HIT))); const w = wheel(kk); return (0.68 + 0.24 * w.near) * (0.3 + 0.7 * w.e) };
    const shown = span(k, RISE, RISE + 0.05) * (1 - span(k, EXIT + 0.01, EXIT + 0.12)), far = k < DIVE && wheel(k).near < 0.5;
    const dragonAt = (kk, alpha) => {
      const size = sizeAt(kk), time = kk * effectMs(cfg) / 1000, spine = [at(kk)];
      // Fixed-length vertebrae follow delayed head positions; the travelling wave grows towards the tail.
      // No frame history: seeking/replaying the tactic gives exactly the same pose.
      for (let i = 1; i <= 44; i++) {
        const t = kk - i * 0.0026, p = at(t), q = at(t + 0.001), l = Math.hypot(q.x - p.x, q.y - p.y) || 1;
        const wave = Math.sin(time * 9 - i * 0.32) * (3 + i * 0.27) * size;
        const x = p.x - (q.y - p.y) / l * wave, y = p.y + (q.x - p.x) / l * wave;
        const prev = spine[i - 1], dx = x - prev.x, dy = y - prev.y, d = Math.hypot(dx, dy) || 1;
        spine.push({ x: prev.x + dx / d * 5.2 * size, y: prev.y + dy / d * 5.2 * size });
      }
      ctx.save(); ctx.globalAlpha *= alpha; ctx.lineCap = "round"; ctx.lineJoin = "round";
      const stroke = (points, color, width) => { ctx.beginPath(); points.forEach((p, i) => ctx[i ? "lineTo" : "moveTo"](p[0], p[1])); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke() };
      const local = (i, draw) => {
        const p = spine[i], q = spine[Math.min(44, i + 1)];
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.atan2(p.y - q.y, p.x - q.x)); ctx.scale(size, size); draw(); ctx.restore();
      };
      // Four hooked legs paddle and fold back as the dragon dives.
      for (const i of [9, 23]) for (const side of [-1, 1]) local(i, () => {
        const kick = Math.sin(time * 7 - i * 0.22 + side) * 5, tuck = span(kk, DIVE, HIT) * 8;
        const foot = [-13 - tuck + kick, side * (24 - tuck)];
        const leg = [[0, side * 5], [-6 + kick, side * 17], foot];
        stroke(leg, "#062e2c", 7); stroke(leg, "#41b888", 4);
        for (let toe = -1; toe <= 1; toe++) stroke([foot, [foot[0] + 7 + toe * 3, foot[1] + side * (4 + toe * 3)]], "#f3dda0", 1.7);
      });
      for (let i = 43; i >= 0; i--) {
        const p = spine[i], q = spine[i + 1], radius = (1.1 + 8 * Math.pow(1 - i / 44, 0.65)) * size;
        stroke([[q.x, q.y], [p.x, p.y]], "#073d36", radius * 2 + 3 * size);
        stroke([[q.x, q.y - radius * 0.15], [p.x, p.y - radius * 0.15]], cfg.c, radius * 2);
        stroke([[q.x, q.y + radius * 0.42], [p.x, p.y + radius * 0.42]], "#b7cf86", radius * 0.65);
        if (i % 2 === 0) local(i, () => {
          const r = radius / size, flutter = Math.sin(time * 12 - i * 0.6) * 3;
          ctx.fillStyle = "#73e3b2"; ctx.beginPath(); ctx.moveTo(2, -r * 0.7); ctx.lineTo(-6, -r - 6 + flutter); ctx.lineTo(-5, -r * 0.35); ctx.fill();
          stroke([[0, -r * 0.4], [-2, 0], [0, r * 0.35]], "#0c765b", 1.2);
          dot(ctx, 1, -r * 0.45, 1, "#c6f5bc");
        });
      }
      local(0, () => {
        const breath = Math.sin(time * 8), roar = span(kk, DIVE - 0.04, HIT) * (1 - span(kk, EXIT, EXIT + 0.06));
        // Swept mane, forked antlers, brows and a lower jaw opening on the strike.
        for (let j = 0; j < 7; j++) {
          const y = -12 + j * 4, flutter = Math.sin(time * 11 - j * 0.8) * 4;
          stroke([[-3, y], [-17, y * 1.4 + flutter], [-29 - j % 3 * 3, y * 1.5 + flutter * 1.5]], j % 2 ? "#d9edbb" : "#57ca9c", 3);
        }
        for (const side of [-1, 1]) {
          stroke([[-2, side * 8], [-10, side * 23], [-22, side * 27]], "#f4dda2", 3);
          stroke([[-10, side * 23], [-8, side * 30]], "#f4dda2", 2);
        }
        ctx.fillStyle = "#0a4e40"; ctx.beginPath(); ctx.ellipse(0, 0, 16, 12, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = "#4ac795"; ctx.beginPath(); ctx.ellipse(3, -3, 14, 9, 0, 0, TAU); ctx.fill();
        stroke([[6, 5], [22, 8 + roar * 6]], "#b7d493", 6);
        stroke([[8, 1], [24, 2]], "#82dfac", 10);
        stroke([[9, 5], [23, 5]], "#07342e", 2);
        for (const x of [13, 20]) stroke([[x, 5], [x - 1, 8 + roar * 2]], "#fff0c0", 1.8);
        stroke([[-1, -8], [10, -7]], "#eddb9c", 3);
        dot(ctx, 7, -5, 2.8, "#ffdf72"); dot(ctx, 8, -5, 1.1, "#142b26"); dot(ctx, 9, -6, 0.8, "#ffffff");
        dot(ctx, 24, 0, 1.8, "#07342e");
        for (const side of [-1, 1]) {
          ctx.beginPath(); ctx.moveTo(19, side * 4);
          ctx.bezierCurveTo(28, side * 18, -17, side * 22 + breath * 5, -38, side * 13 + Math.sin(time * 9 - 1) * 7);
          ctx.strokeStyle = "#e1f2c1"; ctx.lineWidth = 1.5; ctx.stroke();
        }
      });
      ctx.restore();
    };
    const call = span(k, 0, 0.08) * (1 - span(k, DIVE + 0.02, DIVE + 0.12));       // while the blade is up, and through its fall
    if (layer === "back") {
      const a = span(k, 0, 0.1) * (1 - span(k, 0.9, 1));
      ctx.fillStyle = `rgba(3,16,18,${(0.55 * a).toFixed(3)})`; ctx.fillRect(0, 0, W, H);
      lit(ctx, () => {
        // the lifted blade opens the sky: a shaft of light from its point
        const shaft = call * (1 - span(k, DIVE - 0.04, DIVE));
        if (shaft > 0) { const g = ctx.createLinearGradient(0, tip.y, 0, 0), w = 8 + 22 * shaft + 4 * Math.sin(env.now / 90); g.addColorStop(0, rgba(cfg.c2, 0.75 * shaft)); g.addColorStop(1, rgba(cfg.c, 0)); ctx.fillStyle = g; ctx.fillRect(tip.x - w / 2, 0, w, tip.y) }
        ring(ctx, caster.x, caster.y, 26 + 70 * easeOut(span(k, 0, 0.14)), 4, cfg.c2, call * (1 - span(k, 0, 0.14)), 0.38);
        // the wake it leaves round the sky
        if (k > RISE && k < EXIT) for (let j = 1; j <= 16; j++) { const kk = k - j * 0.007; if (kk < RISE) break; const p = at(kk); glow(ctx, p.x, p.y, sizeAt(kk) / full * (50 - j * 2.6), j % 3 ? cfg.c : cfg.c2, 0.32 * shown * (1 - j / 16)) }
      });
      if (far && shown > 0) dragonAt(k, shown * 0.92);                             // on the far side of its ring: behind the clouds
      for (let i = 0; i < 16; i++) {                                               // clouds, gathering as he calls
        const drift = (1 - easeOut(span(k, 0, 0.3))) * (i % 2 ? 180 : -180), x = (i + 0.5) * W / 16 + drift + Math.sin(env.now / 900 + i) * 12, y = 46 + rnd(i, 2) * 150;
        glow(ctx, x, y, 40 + rnd(i, 3) * 34, "#e6fff2", 0.24 * a); glow(ctx, x + 24, y + 8, 28 + rnd(i, 4) * 20, "#ffffff", 0.16 * a);
      }
      lit(ctx, () => {
        for (let i = 0; i < 3; i++) {                                              // lightning runs through them
          const beat = Math.floor(env.now / 110) + i * 5; if (beat % 5) continue;
          const x = 40 + rnd(beat, 1) * (W - 80), y = 50 + rnd(beat, 2) * 110;
          bolt(ctx, x, y, x + (rnd(beat, 3) - 0.5) * 150, y + 30 + rnd(beat, 4) * 60, beat, cfg.c2, "#ffffff", 2, 0.8 * a * (1 - span(k, EXIT, 0.9)));
        }
        // the column it is called down on begins to glow
        const doom = span(k, DIVE - 0.12, HIT) * (1 - span(k, EXIT, 1));
        for (const m of marks) { ctx.save(); ctx.translate(m.t.x, m.t.y); ctx.scale(1, 0.38); glow(ctx, 0, 0, 62, cfg.c, 0.6 * doom); ctx.restore() }
      });
      return;
    }
    lit(ctx, () => {
      // the blade of light: straight up while he calls, then swung down at the enemy
      const fall = easeIn(span(k, DIVE - 0.03, DIVE + 0.04)), ang = -Math.PI / 2 + (Math.PI / 2 + 0.55) * fall, len = 74 * easeOut(span(k, 0, 0.08));
      const bx = hand.x + dir * Math.cos(ang) * len, by = hand.y + Math.sin(ang) * len;
      if (call > 0) {
        streak(ctx, hand.x, hand.y, bx, by, 7, cfg.c2, call); streak(ctx, hand.x, hand.y, bx, by, 2.5, "#ffffff", call);
        glow(ctx, bx, by, 24 + 8 * Math.sin(env.now / 70), cfg.c2, 0.9 * call); glow(ctx, bx, by, 9, "#ffffff", call);
        for (let i = 0; i < 12; i++) { const up = (env.now / 700 + i / 12) % 1, turn = env.now / 130 + i * 1.9; glow(ctx, caster.x + Math.cos(turn) * (34 - 22 * up), caster.y - up * (caster.tall + 70), 3 + 3 * (1 - up), i % 2 ? cfg.c : cfg.c2, call * (1 - up) * (1 - fall)) }   // wind winding up round him
      }
      const cut = span(k, DIVE - 0.02, DIVE + 0.12);                               // the arc the falling blade leaves
      if (cut > 0 && cut < 1) {
        const rot = dir > 0 ? -0.5 : Math.PI + 0.5, open = 2.5 * easeOut(Math.min(1, cut * 3));
        crescent(ctx, hand.x, hand.y, 92, rot, open, 30, cfg.c, cfg.c2, 1 - cut); crescent(ctx, hand.x, hand.y, 70, rot, open * 0.85, 14, cfg.c2, "#ffffff", (1 - cut) * 0.85);
      }
    });
    if (shown > 0 && !far) {
      lit(ctx, () => { const p = at(k); glow(ctx, p.x, p.y, 120 * sizeAt(k) / full, cfg.c, 0.3 * shown) });
      dragonAt(k, shown);
    }
    // the lance of light it draws down the column behind it
    const lance = span(k, DIVE, DIVE + 0.03) * (1 - span(k, EXIT - 0.02, EXIT + 0.14));
    if (lance > 0) lit(ctx, () => {
      const upto = along(Math.min(k, EXIT));
      ctx.beginPath(); for (let s = 0; s <= 28; s++) { const p = spline(road, upto * s / 28); ctx[s ? "lineTo" : "moveTo"](p.x, p.y) }
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.lineWidth = 26; ctx.strokeStyle = rgba(cfg.c, 0.4 * lance); ctx.stroke();
      ctx.lineWidth = 10; ctx.strokeStyle = rgba(cfg.c2, 0.8 * lance); ctx.stroke();
      ctx.lineWidth = 3; ctx.strokeStyle = rgba("#ffffff", lance); ctx.stroke();
    });
    // each of them is struck as it passes through
    marks.forEach((m, i) => impact(ctx, span(k, passes(i), passes(i) + 0.24), m.t.x, m.t.y, m.t.tall, cfg.c, cfg.c2, 1.5));
    const flash = span(k, HIT, HIT + 0.1);
    if (flash > 0 && flash < 1) { ctx.fillStyle = rgba(cfg.c2, 0.4 * (1 - flash)); ctx.fillRect(0, 0, W, H) }
  },

  /** The eight trigrams turn under both lines; he calls the wind and the rain: clouds, gales, a whirlwind, lightning. */
  storm(ctx, layer, k, env) {
    const { cfg, dir, caster, W, H } = env, f = field(env), a = span(k, 0, 0.16) * (1 - span(k, 0.88, 1));
    if (layer === "back") {
      ctx.fillStyle = `rgba(14,22,44,${(0.42 * a).toFixed(3)})`; ctx.fillRect(0, 0, W, H);
      // clouds roll in from his side
      for (let i = 0; i < 10; i++) {
        const drift = (1 - easeOut(span(k, 0, 0.3))) * -dir * 260, x = i * W / 8 - 20 + drift + Math.sin(env.now / 800 + i) * 10, y = 58 + rnd(i, 1) * 44;
        ctx.fillStyle = `rgba(34,40,62,${(0.85 * a).toFixed(3)})`; ctx.beginPath(); ctx.ellipse(x, y, 74 + rnd(i, 2) * 36, 24 + rnd(i, 3) * 12, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = `rgba(120,140,180,${(0.25 * a).toFixed(3)})`; ctx.beginPath(); ctx.ellipse(x - 8, y - 9, 50 + rnd(i, 2) * 24, 10, 0, 0, TAU); ctx.fill();
      }
      const grow = easeOut(span(k, 0, 0.3));
      bagua(ctx, f.cx, f.cy + 4, Math.max(130, Math.max(f.w, f.h * 2.2) / 2 + 92) * (0.4 + 0.6 * grow), k * 3.4, a * grow, cfg.c, cfg.c2);
      bagua(ctx, caster.x, caster.y + 2, 58 * (0.4 + 0.6 * grow), -k * 4.2, a * grow, cfg.c, cfg.c2);
      return;
    }
    const blow = span(k, 0.1, 0.3) * (1 - span(k, 0.86, 1));
    lit(ctx, () => {
      const fan = span(k, 0, 0.3);
      if (fan < 1) glow(ctx, caster.x + dir * 16, caster.y - caster.tall * 0.6, 26 + 40 * fan, cfg.c2, 1 - fan);
      // the gale: long bent gusts from his fan across the whole field
      for (let i = 0; i < 14; i++) {
        const y = 190 + rnd(i, 1) * 350, along = (k * 1.5 + rnd(i, 2)) % 1, len = 90 + rnd(i, 3) * 90;
        ctx.beginPath();
        for (let j = 0; j <= 10; j++) { const u = along - j * 0.018, x = caster.x + dir * (u * 620 - 30), yy = y + Math.sin(u * 9 + i) * 24 - u * 30; ctx[j ? "lineTo" : "moveTo"](x, yy) }
        ctx.lineWidth = 2 + rnd(i, 4) * 4; ctx.lineCap = "round"; ctx.strokeStyle = rgba(i % 3 ? cfg.c2 : "#ffffff", blow * (0.25 + 0.5 * Math.sin(along * Math.PI)) * len / 180); ctx.stroke();
      }
      // the rain, slanting with the wind over the enemy's half
      const wet = span(k, 0.22, 0.4) * (1 - span(k, 0.86, 1));
      for (let i = 0; i < 80; i++) {
        const fall = (k * 3.1 + rnd(i, 5)) % 1, x = f.x0 - 110 + rnd(i, 6) * (f.w + 220) + dir * fall * 60, y = 90 + fall * (f.y1 - 70);
        ctx.strokeStyle = rgba(cfg.c2, wet * 0.6); ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(x - dir * 7, y - 20); ctx.lineTo(x, y); ctx.stroke();
      }
      // a whirlwind stands up in their midst
      const spin = span(k, 0.28, 0.5) * (1 - span(k, 0.84, 0.98));
      for (let j = 0; j < 8; j++) {
        const lift = j / 7, r = 20 + lift * 58 + Math.sin(env.now / 140 + j) * 5, y = f.cy - lift * 200, start = env.now / 90 + j * 0.9;
        ctx.save(); ctx.translate(f.cx + Math.sin(env.now / 200 + j * 0.6) * 9 * lift, y); ctx.scale(1, 0.3);
        ctx.beginPath(); ctx.arc(0, 0, r, start, start + 4.4); ctx.lineWidth = 5 - lift * 2; ctx.strokeStyle = rgba(j % 2 ? cfg.c2 : "#ffffff", spin * 0.75); ctx.stroke(); ctx.restore();
      }
    });
    strikes(ctx, k, env, cfg.c, cfg.c2);
    impacts(ctx, k, env, 1.2);
  },

  /** Benevolence: the word shines over him, the people he sheltered stand far behind with their lanterns, and their light flows into his men. */
  grace(ctx, layer, k, env) {
    const { cfg, caster } = env, f = field(env), a = span(k, 0, 0.18) * (1 - span(k, 0.88, 1));
    const seal = { x: caster.x, y: caster.y - caster.tall - 74 };
    const folk = Array.from({ length: 11 }, (_, i) => ({ x: f.cx - 190 + i * 38 + (rnd(i, 1) - 0.5) * 14, y: 203 + rnd(i, 2) * 12, s: 0.8 + rnd(i, 3) * 0.35 }));
    if (layer === "back") {
      lit(ctx, () => { glow(ctx, caster.x, caster.y - caster.tall * 0.6, 250, cfg.c, 0.55 * a); glow(ctx, seal.x, seal.y, 120, cfg.c2, 0.6 * a) });
      // the people: small, far off, arms raised, a lantern each
      for (const [i, p] of folk.entries()) {
        const up = span(k, 0.05 + i * 0.012, 0.25 + i * 0.012) * (1 - span(k, 0.86, 1)), arm = Math.sin(env.now / 260 + i) * 4;
        ctx.fillStyle = `rgba(70,46,20,${(0.8 * up).toFixed(3)})`; ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 2.4 * p.s; ctx.lineCap = "round";
        dot(ctx, p.x, p.y - 26 * p.s, 5.5 * p.s, ctx.fillStyle);
        ctx.beginPath(); ctx.moveTo(p.x - 6 * p.s, p.y); ctx.lineTo(p.x - 4 * p.s, p.y - 20 * p.s); ctx.lineTo(p.x + 4 * p.s, p.y - 20 * p.s); ctx.lineTo(p.x + 6 * p.s, p.y); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(p.x - 4 * p.s, p.y - 18 * p.s); ctx.lineTo(p.x - 11 * p.s, p.y - (30 + arm) * p.s); ctx.moveTo(p.x + 4 * p.s, p.y - 18 * p.s); ctx.lineTo(p.x + 11 * p.s, p.y - (31 - arm) * p.s); ctx.stroke();
        lit(ctx, () => glow(ctx, p.x + 11 * p.s, p.y - (36 - arm) * p.s, 9 * p.s, cfg.c2, up));
      }
      // 仁 (benevolence) in a ring of light, rays turning slowly round it
      lit(ctx, () => { for (let i = 0; i < 12; i++) { const ang = i * TAU / 12 + env.now / 2600; streak(ctx, seal.x + Math.cos(ang) * 44, seal.y + Math.sin(ang) * 44, seal.x + Math.cos(ang) * (84 + 10 * Math.sin(env.now / 300 + i)), seal.y + Math.sin(ang) * (84 + 10 * Math.sin(env.now / 300 + i)), 3, cfg.c2, 0.6 * a) } });
      ring(ctx, seal.x, seal.y, 40, 4, cfg.c2, a);
      words(ctx, "仁", seal.x, seal.y + 2, 54 + 3 * Math.sin(env.now / 240), cfg.c2, tone(cfg.c, 0.45), a, undefined, '"Noto Serif CJK SC", "Songti SC", "SimSun", serif');
      return;
    }
    lit(ctx, () => {
      // the light flows down to each of his own: from the word above him, and from the people's lanterns
      env.targets.forEach((t, i) => {
        const reach = span(k, 0.24 + i * 0.03, HIT), gone = span(k, HIT, HIT + 0.22), to = { x: t.x, y: t.y - t.tall * 0.6 };
        if (reach <= 0 || gone >= 1) return;
        for (const from of [seal, folk[(i * 3 + 1) % folk.length]]) {
          const top = { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - 60 }, at = (v) => ({ x: (1 - v) * (1 - v) * from.x + 2 * v * (1 - v) * top.x + v * v * to.x, y: (1 - v) * (1 - v) * from.y + 2 * v * (1 - v) * top.y + v * v * to.y });
          ctx.beginPath(); for (let s = 0; s <= 16; s++) { const q = at(s / 16 * reach); ctx[s ? "lineTo" : "moveTo"](q.x, q.y) }
          ctx.lineWidth = from === seal ? 5 : 2.5; ctx.lineCap = "round"; ctx.strokeStyle = rgba(cfg.c2, 0.7 * (1 - gone)); ctx.stroke();
          const tipAt = at(reach); glow(ctx, tipAt.x, tipAt.y, 16, "#ffffff", 1 - gone);
        }
      });
      for (let i = 0; i < 26; i++) { const rise = (k * 1.3 + rnd(i, 4)) % 1; glow(ctx, f.x0 - 50 + rnd(i, 5) * (f.w + 100), f.y1 + 8 - rise * 230, 3 + rnd(i, 6) * 4, i % 2 ? cfg.c : cfg.c2, (1 - rise) * a) }
    });
    blessings(ctx, k, env);
  },

  /** Two wheels of wind and fire are loosed; they weave across each other's path through the whole enemy line. */
  wheels(ctx, layer, k, env) {
    const { cfg, dir, caster } = env, f = field(env), swing = f.h / 2 + 56, shown = span(k, 0.02, 0.1) * (1 - span(k, 0.9, 1));
    const from = { x: caster.x + dir * 20, y: caster.y - 28 }, mid = { x: f.cx, y: f.cy - 34 }, to = { x: f.cx + dir * 270, y: f.cy - 34 };
    // wheel j at time kk: both run the same road, one weaving high where the other weaves low
    const at = (j, kk) => { const p = run(kk, from, mid, to, 0.16), far = span(kk, 0.16, 0.96); return { x: p.x, y: p.y + (j ? 1 : -1) * swing * Math.sin(far * Math.PI * 2.5) * span(kk, 0.16, 0.3) } };
    if (layer === "back") {
      lit(ctx, () => {
        for (const j of [0, 1]) for (let i = 1; i <= 12; i++) {
          const kk = k - i * 0.02; if (kk < 0.16) break;
          const p = at(j, kk), old = i / 12;
          glow(ctx, p.x, p.y, 34 - old * 14, cfg.c, shown * (0.5 - old * 0.4));
          flame(ctx, p.x, p.y + 30, (34 + 20 * rnd(i, j)) * (1 - old * 0.6), 16, cfg.c, cfg.c2, shown * (0.8 - old * 0.6), Math.sin(env.now / 70 + i) * 6);
        }
      });
      return;
    }
    if (shown > 0) lit(ctx, () => {
      for (const j of [0, 1]) {
        const p = at(j, k), size = 34 * (0.5 + 0.5 * span(k, 0.02, 0.16)), turn = env.now / 34 * dir + j * 0.7;
        glow(ctx, p.x, p.y, size * 2.3, cfg.c, 0.55 * shown); glow(ctx, p.x, p.y, size * 0.7, cfg.c2, 0.9 * shown);
        ring(ctx, p.x, p.y, size, 7, cfg.c2, shown); ring(ctx, p.x, p.y, size * 0.55, 3, "#ffffff", 0.8 * shown);
        for (let s = 0; s < 8; s++) { const ang = turn + s * TAU / 8; streak(ctx, p.x, p.y, p.x + Math.cos(ang) * size, p.y + Math.sin(ang) * size, 3, "#ffffff", 0.9 * shown) }
        // fire thrown off the rim, bending back against the spin
        for (let s = 0; s < 12; s++) { const ang = turn * 0.6 + s * TAU / 12, out = size + 6, lag = ang - dir * 0.9, len = 16 + 12 * rnd(s, j + 3); streak(ctx, p.x + Math.cos(lag) * (out + len), p.y + Math.sin(lag) * (out + len), p.x + Math.cos(ang) * out, p.y + Math.sin(ang) * out, 6, s % 2 ? cfg.c : cfg.c2, 0.85 * shown) }
      }
      const burst = span(k, HIT, HIT + 0.24);
      if (burst > 0 && burst < 1) glow(ctx, f.cx, f.cy - 40, 110 + 130 * burst, cfg.c2, (1 - burst) * 0.75);
    });
    impacts(ctx, k, env, 1.2);
  },

  /** The general's own face, huge, bellows from behind him; rings of sound roll over the enemy. */
  roar(ctx, layer, k, env) {
    const { cfg, dir, caster } = env, a = span(k, 0, 0.14) * (1 - span(k, 0.8, 1));
    const mouth = { x: caster.x + dir * 20, y: caster.y - caster.tall * 0.62 };
    if (layer === "back") return giant(ctx, env, a);
    ctx.save(); ctx.shadowColor = cfg.c; ctx.shadowBlur = 16; ctx.lineCap = "round";
    for (let i = 0; i < 7; i++) {
      const ph = k * 2.4 - i * 0.17;
      if (ph <= 0 || ph >= 1) continue;
      const r = 26 + ph * 600, mid = dir > 0 ? 0 : Math.PI, half = 0.95 - ph * 0.25;
      ctx.beginPath(); ctx.arc(mouth.x, mouth.y, r, mid - half, mid + half);
      ctx.lineWidth = 3 + 13 * (1 - ph); ctx.strokeStyle = rgba(i % 2 ? cfg.c : cfg.c2, (1 - ph) * 0.9); ctx.stroke();
    }
    ctx.restore();
    if (cfg.shout) {
      const pop = easeOut(span(k, 0.1, 0.24)), jx = Math.sin(env.now / 23) * 4, jy = Math.cos(env.now / 19) * 3;
      words(ctx, cfg.shout, mouth.x + dir * 135 + jx, mouth.y - 86 + jy, 30 + 22 * pop, "#ffffff", cfg.c, span(k, 0.1, 0.2) * (1 - span(k, 0.78, 0.95)), 260);
    }
    impacts(ctx, k, env, 1.1);
  },

  /** Great arcs of light cut through the targets; a heavy blow falls from above and cracks the ground. */
  slash(ctx, layer, k, env) {
    const { cfg, caster } = env, f = field(env), n = cfg.n ?? 2, chest = f.cy - f.tall * 0.5, R = Math.max(64, Math.max(f.w, f.h) / 2 + 58);
    if (layer === "back") {
      if (cfg.heavy) {
        const q = span(k, HIT, 1);
        if (q > 0) {
          ctx.save(); ctx.translate(f.cx, f.cy + 4); ctx.scale(1, 0.4); ctx.lineCap = "round";
          for (let i = 0; i < 9; i++) {
            const ang = i * TAU / 9 + rnd(i, 4) * 0.5, len = (50 + 90 * rnd(i, 5)) * easeOut(span(q, 0, 0.3));
            ctx.beginPath(); ctx.moveTo(0, 0);
            for (let s = 1; s <= 4; s++) ctx.lineTo(Math.cos(ang + (rnd(i * 5 + s, 6) - 0.5) * 0.5) * len * s / 4, Math.sin(ang + (rnd(i * 5 + s, 6) - 0.5) * 0.5) * len * s / 4);
            ctx.lineWidth = 5; ctx.strokeStyle = rgba(cfg.c2, (1 - q) * 0.9); ctx.stroke();
            ctx.lineWidth = 2; ctx.strokeStyle = `rgba(10,5,5,${(1 - q * 0.6).toFixed(3)})`; ctx.stroke();
          }
          ctx.restore();
        }
      }
      return;
    }
    const ANGLES = [-0.7, 2.5, 1.0];
    for (let j = 0; j < n; j++) {
      const when = HIT - (n - 1 - j) * 0.1, q = (k - when) / 0.2;
      // the lunge: a thread of light from the caster to the cut
      const dash = span(k, when - 0.13, when);
      if (dash > 0 && q < 0.4) lit(ctx, () => streak(ctx, caster.x, caster.y - caster.tall * 0.5, lerp(caster.x, f.cx, dash), lerp(caster.y - caster.tall * 0.5, chest, dash), 5, cfg.c2, 0.8 * (1 - span(q, 0, 0.4))));
      if (q <= 0 || q >= 1) continue;
      const rot = ANGLES[j % 3] + (env.dir < 0 ? Math.PI : 0), open = 2.7 * easeOut(Math.min(1, q * 3.2));
      lit(ctx, () => {
        crescent(ctx, f.cx, chest, R, rot, open, 26, cfg.c, cfg.c2, 1 - q);
        crescent(ctx, f.cx, chest, R * 0.72, rot + 0.2, open * 0.8, 14, cfg.c2, "#ffffff", (1 - q) * 0.8);
        // the cut itself: a white line clean through
        const lx = Math.cos(rot + Math.PI / 2) * (R + 30), ly = Math.sin(rot + Math.PI / 2) * (R + 30);
        streak(ctx, f.cx - lx, chest - ly, f.cx + lx, chest + ly, 4, "#ffffff", 1 - span(q, 0, 0.5));
      });
    }
    if (cfg.heavy) {
      const fall = span(k, HIT - 0.16, HIT), gone = span(k, HIT, HIT + 0.18);
      if (fall > 0 && gone < 1) lit(ctx, () => {
        const tip = lerp(chest - 330, f.cy, easeIn(fall)), g = ctx.createLinearGradient(f.cx, tip - 300, f.cx, tip);
        g.addColorStop(0, rgba(cfg.c, 0)); g.addColorStop(1, rgba(cfg.c2, 1 - gone));
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(f.cx - 22, tip - 300); ctx.lineTo(f.cx + 22, tip - 300); ctx.lineTo(f.cx, tip); ctx.closePath(); ctx.fill();
      });
    }
    impacts(ctx, k, env, cfg.heavy ? 1.4 : 1);
  },

  /** The rider's own shade thunders down the line and through the enemy. */
  charge(ctx, layer, k, env) {
    const { cfg, dir, caster } = env, f = field(env);
    const from = { x: caster.x, y: caster.y }, mid = { x: f.cx, y: f.cy }, to = { x: f.cx + dir * 240, y: f.cy };
    const p = run(k, from, mid, to, 0.08), shown = span(k, 0.06, 0.16) * (1 - span(k, 0.82, 0.97));
    if (layer === "back") {
      // dust thrown up along the ground
      for (let i = 0; i < 12; i++) {
        const q = run(Math.max(0.08, k - i * 0.022 - 0.02), from, mid, to, 0.08), r = 10 + i * 2.6;
        ctx.fillStyle = `rgba(190,170,140,${(shown * (0.3 - i * 0.022)).toFixed(3)})`;
        ctx.beginPath(); ctx.ellipse(q.x - dir * 10, q.y - 4 - i * 1.5, r, r * 0.6, 0, 0, TAU); ctx.fill();
      }
      return;
    }
    if (shown > 0) {
      lit(ctx, () => { for (let i = 0; i < 18; i++) { const yy = p.y - 8 - rnd(i, 1) * caster.tall, len = 70 + rnd(i, 2) * 150; streak(ctx, p.x - dir * (len + 20 + rnd(i, 3) * 60), yy, p.x - dir * (10 + rnd(i, 3) * 40), yy, 2 + rnd(i, 4) * 3, i % 2 ? cfg.c : cfg.c2, shown * 0.75) } });
      if (caster.s?.ready) {
        const anim = animOf(caster.s, "walk"), scale = caster.tall / caster.s.h * 1.2;
        for (let i = 4; i >= 1; i--) { const q = run(Math.max(0.08, k - i * 0.03), from, mid, to, 0.08); drawSprite(ctx, caster.s, anim, env.now * 1.6, q.x, q.y, { scale, faceRight: dir > 0, alpha: shown * (0.36 - i * 0.07) }) }
        lit(ctx, () => glow(ctx, p.x, p.y - caster.tall * 0.5, 100, cfg.c, 0.45 * shown));
        drawSprite(ctx, caster.s, anim, env.now * 1.6, p.x, p.y, { scale, faceRight: dir > 0, alpha: shown * 0.85 });
      } else lit(ctx, () => glow(ctx, p.x, p.y - 50, 70, cfg.c2, shown));
    }
    impacts(ctx, k, env, 1.2);
  },

  /** A volley arcs over and rains down, or one great arrow flies straight. */
  arrows(ctx, layer, k, env) {
    const { cfg, caster } = env;
    if (layer === "back") return;
    const bow = { x: caster.x + env.dir * 18, y: caster.y - caster.tall * 0.6 };
    if (cfg.big) {
      const t = env.targets[0], aim = { x: t.x, y: t.y - t.tall * 0.5 }, draw = span(k, 0.05, 0.36), fly = easeIn(span(k, 0.36, HIT));
      lit(ctx, () => {
        if (fly <= 0) { glow(ctx, bow.x, bow.y, 20 + 46 * draw, cfg.c, 0.9 * draw); ring(ctx, bow.x, bow.y, 60 * (1 - draw) + 8, 3, cfg.c2, draw); }
        else if (k < HIT + 0.05) {
          const hx = lerp(bow.x, aim.x, fly), hy = lerp(bow.y, aim.y, fly), tx = lerp(bow.x, aim.x, Math.max(0, fly - 0.45)), ty = lerp(bow.y, aim.y, Math.max(0, fly - 0.45));
          streak(ctx, tx, ty, hx, hy, 16, cfg.c, 0.9); streak(ctx, tx, ty, hx, hy, 6, "#ffffff", 1); glow(ctx, hx, hy, 34, cfg.c2, 1);
          for (let i = 1; i <= 3; i++) ring(ctx, lerp(bow.x, hx, i / 4), lerp(bow.y, hy, i / 4), 10 + i * 5, 2, cfg.c2, 0.5 * fly);
        }
      });
      return impacts(ctx, k, env, 1.7);
    }
    const n = cfg.n ?? 12;
    lit(ctx, () => {
      for (let i = 0; i < n; i++) {
        const t = env.targets[i % env.targets.length], land = HIT - 0.07 + rnd(i, 1) * 0.16, u = span(k, land - 0.34, land);
        if (u <= 0) continue;
        const end = { x: t.x + (rnd(i, 2) - 0.5) * 44, y: t.y - rnd(i, 3) * t.tall * 0.7 }, top = { x: (bow.x + end.x) / 2, y: Math.min(bow.y, end.y) - 190 - rnd(i, 4) * 90 };
        const at = (v) => ({ x: (1 - v) * (1 - v) * bow.x + 2 * v * (1 - v) * top.x + v * v * end.x, y: (1 - v) * (1 - v) * bow.y + 2 * v * (1 - v) * top.y + v * v * end.y });
        if (u < 1) { const a = at(Math.max(0, u - 0.1)), b = at(u); streak(ctx, a.x, a.y, b.x, b.y, 4, cfg.c2, 1); glow(ctx, b.x, b.y, 9, cfg.c, 0.9) }
        else { const q = span(k, land, land + 0.2); glow(ctx, end.x, end.y, 26 * (1 - q) + 6, cfg.c2, 1 - q) }
      }
    });
    impacts(ctx, k, env);
  },

  /** A line of fire is shot across; a wall of flame runs over the enemy's ground. big: the whole field burns, higher. */
  fire(ctx, layer, k, env) {
    const { cfg, dir, caster } = env, f = field(env), big = cfg.big ? 1.45 : 1, x0 = f.x0 - 56 * big, x1 = f.x1 + 56 * big, a = 1 - span(k, 0.8, 1);
    if (layer === "back") {
      if (cfg.big) { ctx.fillStyle = `rgba(90,20,0,${(0.3 * span(k, 0.15, 0.4) * a).toFixed(3)})`; ctx.fillRect(0, 0, env.W, env.H) }
      lit(ctx, () => { ctx.save(); ctx.translate(f.cx, f.cy); ctx.scale(1, 0.42); glow(ctx, 0, 0, (x1 - x0) / 2 + 60, cfg.c, 0.6 * span(k, 0.2, 0.5) * a); ctx.restore() });
      return;
    }
    lit(ctx, () => {
      const shot = span(k, 0.04, 0.3);
      if (shot > 0 && shot < 1) { const hx = lerp(caster.x, dir > 0 ? x0 : x1, shot), hy = lerp(caster.y - caster.tall * 0.6, f.cy - 30, shot); streak(ctx, caster.x, caster.y - caster.tall * 0.6, hx, hy, 9, cfg.c, 0.9); glow(ctx, hx, hy, 24, cfg.c2, 1) }
      const tongues = [];
      for (let i = 0; i < (cfg.big ? 46 : 30); i++) {
        const along = rnd(i, 1), x = lerp(x0, x1, along), y = f.y0 - 6 + rnd(i, 2) * (f.h + 26), lit0 = 0.2 + 0.36 * (dir > 0 ? along : 1 - along);
        const up = span(k, lit0, lit0 + 0.1) * a;
        if (up > 0) tongues.push({ x, y, h: (46 + 84 * rnd(i, 3)) * big * up * (0.8 + 0.2 * Math.sin(env.now / 55 + i * 1.7)) * (k > HIT - 0.03 && k < HIT + 0.12 ? 1.35 : 1), w: (22 + 22 * rnd(i, 4)) * big, sway: Math.sin(env.now / 80 + i) * 9, up });
      }
      tongues.sort((p, q) => p.y - q.y);
      for (const t of tongues) { flame(ctx, t.x, t.y, t.h, t.w, cfg.c, cfg.c2, 0.85 * t.up, t.sway); flame(ctx, t.x, t.y, t.h * 0.55, t.w * 0.5, cfg.c2, "#ffffff", 0.8 * t.up, t.sway * 0.5) }
      for (let i = 0; i < 34; i++) { const rise = (k * 1.7 + rnd(i, 5)) % 1; glow(ctx, lerp(x0, x1, rnd(i, 6)) + Math.sin(rise * 7 + i) * 10, f.y1 - rise * 210 * big, 3 + rnd(i, 7) * 3, i % 2 ? cfg.c : cfg.c2, (1 - rise) * span(k, 0.25, 0.4) * a) }
      const burst = span(k, HIT, HIT + 0.22);
      if (burst > 0 && burst < 1) glow(ctx, f.cx, f.cy - 40, (120 + 120 * burst) * big, cfg.c2, (1 - burst) * 0.8);
    });
    impacts(ctx, k, env, cfg.big ? 1.25 : 1);
  },

  /** Talismans fly up, the sky goes dark, and lightning comes down on every target. */
  thunder(ctx, layer, k, env) {
    const { cfg, dir, caster, W } = env, a = span(k, 0, 0.15) * (1 - span(k, 0.85, 1));
    if (layer === "back") {
      ctx.fillStyle = `rgba(8,8,34,${(0.4 * a).toFixed(3)})`; ctx.fillRect(0, 0, W, env.H);
      for (let i = 0; i < 7; i++) { ctx.fillStyle = `rgba(30,28,52,${(0.75 * a).toFixed(3)})`; ctx.beginPath(); ctx.ellipse(i * W / 6 + Math.sin(env.now / 900 + i) * 14, 70 + rnd(i, 1) * 26, 70 + rnd(i, 2) * 40, 24 + rnd(i, 3) * 12, 0, 0, TAU); ctx.fill() }
      return;
    }
    if (cfg.sand) for (let i = 0; i < 44; i++) {
      const y = 150 + rnd(i, 1) * 400, len = 50 + rnd(i, 2) * 110, x = ((rnd(i, 3) * W + dir * k * 1500) % (W + len) + (W + len)) % (W + len) - len / 2;
      streak(ctx, x - dir * len, y, x, y, 2 + rnd(i, 4) * 4, "#d8b25a", 0.55 * a);
    }
    env.targets.forEach((t, i) => {
      // a talisman flies to hang over each target
      const u = easeOut(span(k, 0.06 + i * 0.03, 0.46 + i * 0.03)), px = lerp(caster.x, t.x, u), py = lerp(caster.y - caster.tall * 0.7, t.y - t.tall - 54, u) - Math.sin(u * Math.PI) * 60;
      if (u > 0 && k < HIT + 0.2) {
        ctx.save(); ctx.translate(px, py); ctx.rotate(u < 1 ? env.now / 60 + i : Math.sin(env.now / 150 + i) * 0.15);
        ctx.shadowColor = cfg.c; ctx.shadowBlur = 14; ctx.fillStyle = rgba(cfg.c, 1 - span(k, HIT + 0.05, HIT + 0.2)); ctx.fillRect(-6, -12, 12, 24);
        ctx.fillStyle = "rgba(170,30,20,.9)"; ctx.fillRect(-1.5, -9, 3, 18); ctx.restore();
      }
    });
    strikes(ctx, k, env, cfg.c, cfg.c2);
    impacts(ctx, k, env, 1.2);
  },

  /** An eight-trigram array turns under the enemy and pillars of light rise; or a great seal drops on them. */
  array(ctx, layer, k, env) {
    const { cfg } = env, f = field(env), R = Math.max(96, Math.max(f.w, f.h * 2.2) / 2 + 74), a = easeOut(span(k, 0, 0.26)) * (1 - span(k, 0.84, 1));
    if (layer === "back") return bagua(ctx, f.cx, f.cy + 4, R * (0.4 + 0.6 * a), k * 3.2, a, cfg.c, cfg.c2);
    if (cfg.seal) {
      const fall = easeIn(span(k, HIT - 0.2, HIT)), gone = span(k, 0.84, 1), side = 132, y = lerp(-140, f.cy - f.tall - 30, fall);
      if (fall > 0 && gone < 1) {
        ctx.save(); ctx.globalAlpha *= 1 - gone; ctx.translate(f.cx, y + (k > HIT ? Math.sin(span(k, HIT, HIT + 0.1) * Math.PI) * -10 : 0));
        ctx.shadowColor = cfg.c; ctx.shadowBlur = 30;
        ctx.fillStyle = cfg.c; ctx.fillRect(-side / 2, -side / 2, side, side);
        ctx.shadowBlur = 0; ctx.strokeStyle = "#7a1a10"; ctx.lineWidth = 6; ctx.strokeRect(-side / 2 + 10, -side / 2 + 10, side - 20, side - 20);
        ctx.fillStyle = "#7a1a10"; ctx.font = `900 ${side * 0.62}px serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("璽", 0, 4);
        ctx.restore();
      }
    } else pillars(ctx, k, env);
    lit(ctx, () => { for (let i = 0; i < 22; i++) { const ang = rnd(i, 1) * TAU + k * 2, rise = (k * 1.5 + rnd(i, 2)) % 1; glow(ctx, f.cx + Math.cos(ang) * R * rnd(i, 3), f.cy + Math.sin(ang) * R * 0.4 * rnd(i, 3) - rise * 150, 4 + rnd(i, 4) * 4, i % 2 ? cfg.c : cfg.c2, (1 - rise) * a) } });
    impacts(ctx, k, env, cfg.seal ? 1.5 : 1);
  },

  /** A rain of light over the caster's own line. */
  heal(ctx, layer, k, env) {
    const { cfg } = env, f = field(env), a = span(k, 0, 0.2) * (1 - span(k, 0.85, 1));
    if (layer === "back") { lit(ctx, () => { for (const t of env.targets) glow(ctx, t.x, t.y, 64, cfg.c, 0.45 * a) }); return }
    lit(ctx, () => {
      for (let i = 0; i < 46; i++) {
        const x = lerp(f.x0 - 50, f.x1 + 50, rnd(i, 1)), fall = (k * 1.9 + rnd(i, 2)) % 1, y = lerp(90, f.y1 + 6, fall);
        streak(ctx, x, y - 34, x, y, 2 + rnd(i, 3) * 2, i % 3 ? cfg.c2 : cfg.c, a * (0.3 + 0.6 * fall));
      }
    });
    blessings(ctx, k, env);
  },

  /** A pale moon, a ribbon of silk, and petals that close on the enemy and scatter. */
  charm(ctx, layer, k, env) {
    const { cfg, caster } = env, f = field(env), a = span(k, 0, 0.18) * (1 - span(k, 0.84, 1)), heart = { x: f.cx, y: f.cy - f.tall * 0.5 };
    if (layer === "back") {
      lit(ctx, () => { glow(ctx, f.cx, 150, 150, cfg.c, 0.5 * a); glow(ctx, f.cx, 150, 62, cfg.c2, a) });
      dot(ctx, f.cx, 150, 46, rgba(cfg.c2, 0.9 * a));
      return;
    }
    // the ribbon dances from her hand to them
    const reach = span(k, 0.06, HIT - 0.05);
    if (reach > 0 && k < HIT + 0.15) {
      ctx.save(); ctx.lineCap = "round"; ctx.shadowColor = cfg.c; ctx.shadowBlur = 12;
      ctx.beginPath();
      for (let s = 0; s <= 30; s++) { const u = s / 30 * reach, x = lerp(caster.x, heart.x, u), y = lerp(caster.y - caster.tall * 0.6, heart.y, u) + Math.sin(u * 12 - env.now / 110) * 22 * Math.sin(u * Math.PI); ctx[s ? "lineTo" : "moveTo"](x, y) }
      ctx.lineWidth = 7; ctx.strokeStyle = rgba(cfg.c, 0.85 * (1 - span(k, HIT, HIT + 0.15))); ctx.stroke();
      ctx.lineWidth = 2; ctx.strokeStyle = rgba("#ffffff", 0.9 * (1 - span(k, HIT, HIT + 0.15))); ctx.stroke(); ctx.restore();
    }
    for (let i = 0; i < 54; i++) {
      const closing = span(k, 0.1 + rnd(i, 1) * 0.1, HIT), out = span(k, HIT, 1), ang = i * 2.4 + k * 9 + rnd(i, 2);
      const r = k < HIT ? (1 - easeIn(closing)) * (170 + rnd(i, 3) * 90) + 14 : 14 + easeOut(out) * (120 + 220 * rnd(i, 4));
      const x = heart.x + Math.cos(ang) * r, y = heart.y + Math.sin(ang) * r * 0.62 + (k > HIT ? out * out * 90 : 0);
      ctx.save(); ctx.translate(x, y); ctx.rotate(ang * 2 + env.now / 200);
      ctx.fillStyle = rgba(i % 4 ? cfg.c : cfg.c2, a * (k < HIT ? closing : 1 - out) * 0.95);
      ctx.beginPath(); ctx.ellipse(0, 0, 9, 4.5, 0, 0, TAU); ctx.fill(); ctx.restore();
    }
    impacts(ctx, k, env);
  },

  /** A black tide of smoke rolls out of the caster and breaks over the enemy. giant: his own shape looms behind him. */
  dark(ctx, layer, k, env) {
    const { cfg, dir, caster } = env, f = field(env), a = 1 - span(k, 0.8, 1), front = lerp(caster.x, f.cx + dir * 210, easeOut(span(k, 0.04, 0.78)));
    if (layer === "back") {
      ctx.fillStyle = `rgba(20,4,30,${(0.35 * span(k, 0, 0.2) * a).toFixed(3)})`; ctx.fillRect(0, 0, env.W, env.H);
      if (cfg.giant) giant(ctx, env, span(k, 0, 0.16) * a, "idle");
      return;
    }
    for (let i = 0; i < 34; i++) {
      const part = Math.pow(rnd(i, 1), 0.55), x = lerp(caster.x, front, part), y = f.cy - 46 + (rnd(i, 2) - 0.5) * (f.h + 190) + Math.sin(env.now / 260 + i) * 10;
      const r = (34 + rnd(i, 3) * 56) * (0.5 + 0.5 * span(k, 0, 0.3)), g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(18,6,30,${(0.62 * a).toFixed(3)})`); g.addColorStop(0.6, rgba(cfg.c, 0.28 * a)); g.addColorStop(1, rgba(cfg.c, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    }
    lit(ctx, () => {
      for (let i = 0; i < 5; i++) {
        const beat = Math.floor(k * 14 + i * 1.3);
        if ((beat + i) % 3) continue;
        const x = lerp(caster.x, front, rnd(beat, i + 1)), y = f.cy - 50 + (rnd(beat, i + 5) - 0.5) * (f.h + 150);
        bolt(ctx, x, y, x + (rnd(beat, i + 9) - 0.5) * 130, y + (rnd(beat, i + 13) - 0.5) * 90, beat + i, cfg.c2, "#ffffff", 2, 0.85 * a);
      }
      const burst = span(k, HIT, HIT + 0.25);
      if (burst > 0 && burst < 1) { ring(ctx, f.cx, f.cy, 30 + 220 * easeOut(burst), 10 * (1 - burst) + 1, cfg.c2, 1 - burst, 0.4); glow(ctx, f.cx, f.cy - 40, 170, cfg.c2, (1 - burst) * 0.6) }
    });
    impacts(ctx, k, env, 1.1);
  },
};

/** What a blessing leaves on each of the caster's own: a pillar of soft light, a ring, motes rising, small crosses. */
function blessings(ctx, k, env) {
  const { cfg } = env;
  lit(ctx, () => env.targets.forEach((t, i) => {
    const q = span(k, HIT - 0.04 + i * 0.02, 1);
    if (q <= 0 || q >= 1) return;
    const h = 210 * easeOut(Math.min(1, q * 2.5)), g = ctx.createLinearGradient(t.x, t.y, t.x, t.y - h);
    g.addColorStop(0, rgba(cfg.c2, 0.8 * (1 - q))); g.addColorStop(1, rgba(cfg.c, 0));
    ctx.fillStyle = g; ctx.fillRect(t.x - 26, t.y - h, 52, h);
    ring(ctx, t.x, t.y, 14 + 60 * easeOut(q), 4 * (1 - q) + 1, cfg.c2, 1 - q, 0.38);
    for (let j = 0; j < 9; j++) {
      const rise = span(q, rnd(i * 9 + j, 1) * 0.4, 1), x = t.x + (rnd(i * 9 + j, 2) - 0.5) * 60 + Math.sin(rise * 6 + j) * 6, y = t.y - 10 - rise * (t.tall + 40);
      if (rise <= 0) continue;
      if (j % 3) glow(ctx, x, y, 5 + rnd(j, 3) * 4, j % 2 ? cfg.c : cfg.c2, 1 - rise);
      else { ctx.fillStyle = rgba(cfg.c2, 1 - rise); ctx.fillRect(x - 6, y - 2, 12, 4); ctx.fillRect(x - 2, y - 6, 4, 12) }
    }
  }));
}

/** Draw one layer ("back": under the generals; "front": over them) of a tactic's effect at k in 0..1. */
export function drawEffect(ctx, layer, k, env) {
  if (!env.targets.length) return;
  (KINDS[env.cfg.fx] ?? KINDS.slash)(ctx, layer, clamp01(k), env);
}
export const EFFECT_KINDS = Object.keys(KINDS);
