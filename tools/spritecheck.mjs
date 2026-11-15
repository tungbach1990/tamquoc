// Look over sheets without eyes: what the game will read from each (size, feet), which way the face looks,
// and per animation the things that have gone wrong before: the figure shrinking or swelling against its idle
// frame (a lost horse, a second weapon), frames cut off at the cell edge, stray bright-green patches.
//   node tamquoc/tools/spritecheck.mjs [id | beasts/id ...]     (nothing: every sheet in assets/manifest.json)
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readPNG } from "../../demo/lib.mjs";
import { analyze, bbox } from "../src/spritemeta.js";
import { GENERALS } from "../src/data/generals.js";
import { BEASTS } from "../src/data/vfx.js";

const ASSETS = join(dirname(fileURLToPath(import.meta.url)), "../assets");
const manifest = JSON.parse(readFileSync(join(ASSETS, "manifest.json"), "utf8"));
const all = [...manifest.generals.map((id) => `generals/${id}`), ...manifest.beasts.map((id) => `beasts/${id}`)];
const paths = process.argv.length > 2 ? process.argv.slice(2).map((a) => (a.includes("/") ? a : `generals/${a}`)) : all;
const USED = ["idle", "walk", "attack", "skill01", "skill02", "die"];
const odd = [];

for (const path of paths) {
  const [kind, id] = path.split("/"), dir = join(ASSETS, kind, id), json = JSON.parse(readFileSync(join(dir, "sheet.json"), "utf8"));
  const png = readPNG(join(dir, "sheet.png")), rgba = new Uint8Array(png.px.buffer), s = analyze(rgba, png.w, json);
  const px = (f, x, y) => { const i = ((f.y + y) * png.w + f.x + x) * 4; return [rgba[i], rgba[i + 1], rgba[i + 2], rgba[i + 3]] };
  const green = (f) => { let n = 0, all = 0; for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) { const [r, g, b, a] = px(f, x, y); if (a > 127) { all++; if (g > 140 && g > r * 1.5 && g > b * 1.5) n++ } } return all ? n / all : 0 };
  const clipped = (f) => { for (let x = 0; x < f.w; x++) for (const y of [0, f.h - 1]) if (px(f, x, y)[3] > 127) return true; for (let y = 0; y < f.h; y++) for (const x of [0, f.w - 1]) if (px(f, x, y)[3] > 127) return true; return false };
  // how much of the figure sits in its lowest 40%: a horse's body and legs are a big solid mass there, a man's legs are not
  const footprint = (f) => { const b = bbox(rgba, png.w, f); if (!b) return 0; let n = 0; for (let y = Math.max(b.y0, b.y1 - Math.round(s.h * 0.4)); y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) if (px(f, x, y)[3] > 127) n++; return n };

  // Which way the face looks: find the face (the biggest patch of skin in the upper half), then count what
  // lies beside it before open air. Hair and helmet sit behind the face: more on the right -> it looks left.
  // Positive = looks left. Bald, bearded or hooded heads fool it; a rig's other generals settle those.
  const skin = (r, g, b, a) => a > 127 && r > 130 && r >= g && g >= b && r - b > 14 && g > 0.58 * r && g < 0.97 * r && b > 0.42 * r && b < 0.93 * r;
  const lean = (f) => {
    const b = bbox(rgba, png.w, f); if (!b) return null;
    const yMax = b.y0 + Math.round((b.y1 - b.y0 + 1) * 0.5), seen = new Uint8Array(f.w * f.h);
    let best = null;
    for (let y = b.y0; y <= yMax; y++) for (let x = b.x0; x <= b.x1; x++) {
      if (seen[y * f.w + x] || !skin(...px(f, x, y))) continue;
      const stack = [[x, y]], rows = new Map(); seen[y * f.w + x] = 1; let n = 0, x0 = x, x1 = x, y0 = y, y1 = y;
      while (stack.length) {
        const [cx, cy] = stack.pop(); n++; x0 = Math.min(x0, cx); x1 = Math.max(x1, cx); y0 = Math.min(y0, cy); y1 = Math.max(y1, cy);
        const row = rows.get(cy) ?? [cx, cx]; row[0] = Math.min(row[0], cx); row[1] = Math.max(row[1], cx); rows.set(cy, row);
        for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]]) if (nx >= b.x0 && nx <= b.x1 && ny >= b.y0 && ny <= yMax && !seen[ny * f.w + nx] && skin(...px(f, nx, ny))) { seen[ny * f.w + nx] = 1; stack.push([nx, ny]) }
      }
      if (!best || n > best.n) best = { n, w: x1 - x0 + 1, h: y1 - y0 + 1, y0, rows };
    }
    if (!best || best.n < 30) return null;
    let L = 0, R = 0, count = 0;
    for (const [y, [rx0, rx1]] of best.rows) {
      if (y > best.y0 + best.h * 0.6) continue; count++;
      for (let x = rx0 - 1; x >= Math.max(0, rx0 - best.w); x--) { if (px(f, x, y)[3] <= 127) break; L++ }
      for (let x = rx1 + 1; x <= Math.min(f.w - 1, rx1 + best.w); x++) { if (px(f, x, y)[3] <= 127) break; R++ }
    }
    return (R - L) / (count * best.w);
  };
  let sum = 0, n = 0;
  for (const name of ["idle", "walk", "attack"]) { const t = s.tags[name]; if (t) for (let i = t.from; i <= t.to; i++) { const v = lean(s.frames[i]); if (v !== null) { sum += v; n++ } } }
  const looks = n ? sum / n : NaN, drawn = GENERALS[id]?.facing ?? "left";
  if (kind === "generals" && GENERALS[id]) {
    if (Number.isNaN(looks) || Math.abs(looks) < 0.1) odd.push(`${id}: face unclear (${Number.isNaN(looks) ? "no face found" : looks.toFixed(2)})`);
    else if ((looks > 0 ? "left" : "right") !== drawn) odd.push(`${id}: the data says it is drawn facing ${drawn}, the face measures ${looks > 0 ? "left" : "right"} (${looks.toFixed(2)})`);
  }

  // A beast has no face to find. Two hints instead: its head is the heavy end of its upper third (a tail is
  // thin), and its attack lunges forward. Both positive = it is drawn facing left.
  let hint = "";
  if (kind === "beasts") {
    let head = 0, hn = 0, left = 0, right = 0;
    const idle = s.tags.idle ?? Object.values(s.tags)[0], b0 = bbox(rgba, png.w, s.frames[idle.from]);
    for (let i = idle.from; i <= idle.to; i++) {
      const f = s.frames[i], b = bbox(rgba, png.w, f); if (!b) continue;
      let sx = 0, c = 0;
      for (let y = b.y0; y <= b.y0 + (b.y1 - b.y0) * 0.33; y++) for (let x = b.x0; x <= b.x1; x++) if (px(f, x, y)[3] > 127) { sx += x; c++ }
      if (c) { head += ((b.x0 + b.x1) / 2 - sx / c) / (b.x1 - b.x0 + 1); hn++ }
    }
    if (s.tags.attack) for (let i = s.tags.attack.from; i <= s.tags.attack.to; i++) { const a = bbox(rgba, png.w, s.frames[i]); if (a) { left = Math.max(left, b0.x0 - a.x0); right = Math.max(right, a.x1 - b0.x1) } }
    const h = hn ? head / hn : 0, l = (left - right) / s.fw, says = (v, th) => (Math.abs(v) < th ? "?" : v > 0 ? "left" : "right");
    hint = `, drawn facing ${BEASTS[id]?.facing ?? "left"}; head ${h.toFixed(2)} (${says(h, 0.06)}), lunge ${l.toFixed(2)} (${says(l, 0.04)})`;
    if (says(h, 0.06) !== "?" && says(h, 0.06) === says(l, 0.04) && says(h, 0.06) !== (BEASTS[id]?.facing ?? "left")) odd.push(`beasts/${id}: head and lunge both say it is drawn facing ${says(h, 0.06)}`);
  }

  const idle0 = s.frames[(s.tags.idle ?? Object.values(s.tags)[0]).from], area0 = bbox(rgba, png.w, idle0).n, green0 = green(idle0), foot0 = footprint(idle0);
  console.log(`\n${path}: frame ${s.fw}x${s.fh}, figure ${s.w}x${s.h}px, feet (${s.ax},${s.ay})${kind === "generals" ? `, drawn facing ${drawn}, face lean ${Number.isNaN(looks) ? "—" : looks.toFixed(2)}` : hint}; animations: ${Object.keys(s.tags).join(", ")}`);
  for (const name of kind === "generals" ? USED : Object.keys(s.tags)) {
    const t = s.tags[name];
    if (!t) { console.log(`  ${name.padEnd(8)} —`); continue }
    let lo = Infinity, hi = 0, clip = 0, g = 0, empty = 0, foot = Infinity;
    for (let i = t.from; i <= t.to; i++) {
      const b = bbox(rgba, png.w, s.frames[i]);
      if (!b) { empty++; continue }
      lo = Math.min(lo, b.n / area0); hi = Math.max(hi, b.n / area0);
      foot = Math.min(foot, footprint(s.frames[i]) / foot0);
      if (clipped(s.frames[i])) clip++;
      g = Math.max(g, green(s.frames[i]));
    }
    const warn = [];
    if (empty) warn.push(`${empty} empty frame(s)`);
    if (name !== "die" && lo < 0.6) warn.push("figure shrinks");
    // measured: with the horse, walk and attack fill x0.75 of the idle frame or more; without it, x0.45-0.70.
    // "base" (the mass in the lowest 40%) is printed as a second hint; neither is proof, a person has to look
    if (s.mounted && name !== "idle" && lo < (name === "die" ? 0.6 : 0.72)) warn.push("MOUNT MAY BE MISSING");
    if (name !== "skill01" && name !== "skill02" && hi > 2) warn.push("figure swells");
    if (clip) warn.push(`${clip} frame(s) touch the cell edge`);
    if (g > 0.03 && g > green0 * 3) warn.push("more green than the idle frame");
    console.log(`  ${name.padEnd(8)} ${String(t.to - t.from + 1).padStart(2)} frames, area x${lo.toFixed(2)}..${hi.toFixed(2)}, base x${foot.toFixed(2)}, green ${(g * 100).toFixed(0)}%${warn.length ? "   WARN: " + warn.join("; ") : ""}`);
  }
}

console.log(`\nfacing: ${odd.length ? "" : "every sheet measures the way the data says"}`);
for (const line of odd) console.log("  " + line);
