// What the game reads from a sheet: its frames and animations, where the feet are, how tall the figure
// stands. Pure: the browser passes canvas pixels, the check tool a decoded PNG.
//
// Facing isn't read from the pixels. Every sheet the art server makes is drawn facing LEFT (measured on all
// of them by tools/spritecheck.mjs: the hair sits to the right of the face); the game mirrors a figure when it
// has to look right. A sheet that turns out otherwise gets `facing: "right"` in its data entry.

/** Rigs that carry a rider and a mount: drawn taller than a general on foot. */
export const MOUNTED = new Set(["167x123"]);

/** The box of opaque pixels in one frame of the sheet (rgba: 4 bytes a pixel, sw: sheet width), or null. */
export function bbox(rgba, sw, f) {
  let x0 = Infinity, x1 = -1, y0 = Infinity, y1 = -1, n = 0;
  for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++)
    if (rgba[((f.y + y) * sw + f.x + x) * 4 + 3] > 127) { n++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y }
  return n ? { x0, x1, y0, y1, n } : null;
}

/** One frame's figure: its box, how many pixels it fills (n), its middle (cx, cy), and where it stands: fx,
 *  the middle of what is on its lowest rows (a weapon held out to the side doesn't pull that over). Or null. */
export function figure(rgba, sw, f) {
  const b = bbox(rgba, sw, f);
  if (!b) return null;
  let sx = 0, sy = 0, feet = 0, m = 0;
  for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++)
    if (rgba[((f.y + y) * sw + f.x + x) * 4 + 3] > 127) { sx += x; sy += y; if (y >= b.y1 - 9) { feet += x; m++ } }
  return { ...b, cx: sx / b.n, cy: sy / b.n, fx: feet / m };
}
const median = (list) => [...list].sort((p, q) => p - q)[list.length >> 1];
/** What two measures of a frame's movement share: nothing if they disagree or it is under 2px, else the smaller. */
const shared = (p, q) => (p * q > 0 && Math.min(Math.abs(p), Math.abs(q)) >= 2 ? Math.sign(p) * Math.round(Math.min(Math.abs(p), Math.abs(q))) : 0);

/** sheet.json (Aseprite array format with frameTags) + the sheet's pixels -> { frames, tags, fw, fh, ax, ay (the
 *  feet), cx, cy (the figure's middle), w, h, facing, mounted }. Every frame carries its own feet (ax, ay) and
 *  size (k: how much to scale it so the figure in it is as big as the one standing idle); for most that is the
 *  first idle frame's feet and 1. Two faults of the sheets are put right here:
 *  - steady: an idle frame whose whole figure sits a few pixels off the others (its feet and its mass moved
 *    together) is put back, so a general standing still does not shake. Not for beasts: a bird's bob is real.
 *  - a rider drawn bigger in one animation than standing (Zhao Yun and Cao Cao strike a third larger) is
 *    scaled back, and stands on that animation's own first frame. */
export function analyze(rgba, sw, json, { steady = false } = {}) {
  const frames = json.frames.map((fr) => ({ ...fr.frame, dur: fr.duration || 83 }));
  const tags = Object.fromEntries(json.meta.frameTags.map((t) => [t.name, { from: t.from, to: t.to }]));
  const idle = tags.idle ?? Object.values(tags)[0], f0 = frames[idle.from], mounted = MOUNTED.has(`${f0.w}x${f0.h}`);
  const figures = (t) => frames.slice(t.from, t.to + 1).map((f) => figure(rgba, sw, f));
  const still = figures(idle), b = still[0] ?? { x0: 0, x1: f0.w - 1, y0: 0, y1: f0.h - 1, cx: f0.w / 2, cy: f0.h / 2, fx: f0.w / 2 };
  const ax = Math.round(b.fx), ay = b.y1 + 1;
  for (const f of frames) { f.ax = ax; f.ay = ay; f.k = 1 }
  if (steady && still[0]) still.forEach((g, i) => {
    if (!g) return;
    frames[idle.from + i].ax = ax + shared(g.fx - b.fx, g.cx - b.cx);
    frames[idle.from + i].ay = ay + shared(g.y1 - b.y1, g.cy - b.cy);
  });
  // ponytail: how much of the cell a figure fills tells its size only where every animation shows the same things.
  // That holds for the riders' rig, and not in general (Yang Jian walks on a cloud, a skill draws its own fire),
  // so only riders are measured; a wrong-sized figure in another rig needs someone to look and a number in its data.
  if (mounted && still[0]) for (const name of ["walk", "attack"]) {
    const t = tags[name], shown = t ? figures(t) : [];
    if (shown.length === 0 || shown.includes(null) || still.includes(null)) continue;
    const r = Math.sqrt(median(shown.map((g) => g.n)) / median(still.map((g) => g.n)));
    if (Math.abs(r - 1) <= 0.15) continue;
    for (let i = t.from; i <= t.to; i++) Object.assign(frames[i], { ax: Math.round(shown[0].fx), ay: shown[0].y1 + 1, k: 1 / r });
  }
  return { frames, tags, fw: f0.w, fh: f0.h, ax, ay, cx: (b.x0 + b.x1 + 1) / 2, cy: (b.y0 + b.y1 + 1) / 2, h: b.y1 - b.y0 + 1, w: b.x1 - b.x0 + 1, facing: "left", mounted };
}

/** Whether a figure must be mirrored: it is drawn facing `facing` and has to look right or left. */
export const mustFlip = (facing, faceRight) => (facing === "right") !== faceRight;
