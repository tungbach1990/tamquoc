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

/** sheet.json (Aseprite array format with frameTags) + the sheet's pixels -> { frames, tags, fw, fh, ax, ay (the feet), cx, cy (the figure's middle), w, h, facing, mounted }. */
export function analyze(rgba, sw, json) {
  const frames = json.frames.map((fr) => ({ ...fr.frame, dur: fr.duration || 83 }));
  const tags = Object.fromEntries(json.meta.frameTags.map((t) => [t.name, { from: t.from, to: t.to }]));
  const idle = tags.idle ?? Object.values(tags)[0], f0 = frames[idle.from];
  const b = bbox(rgba, sw, f0) ?? { x0: 0, x1: f0.w - 1, y0: 0, y1: f0.h - 1 };
  // the feet: the middle of what stands on the lowest rows (a weapon held out to the side doesn't pull it over)
  let sum = 0, n = 0;
  for (let y = Math.max(b.y0, b.y1 - 9); y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++)
    if (rgba[((f0.y + y) * sw + f0.x + x) * 4 + 3] > 127) { sum += x; n++ }
  const ax = n ? Math.round(sum / n) : Math.round((b.x0 + b.x1) / 2), ay = b.y1 + 1;
  return { frames, tags, fw: f0.w, fh: f0.h, ax, ay, cx: (b.x0 + b.x1 + 1) / 2, cy: (b.y0 + b.y1 + 1) / 2, h: b.y1 - b.y0 + 1, w: b.x1 - b.x0 + 1, facing: "left", mounted: MOUNTED.has(`${f0.w}x${f0.h}`) };
}

/** Whether a figure must be mirrored: it is drawn facing `facing` and has to look right or left. */
export const mustFlip = (facing, faceRight) => (facing === "right") !== faceRight;
