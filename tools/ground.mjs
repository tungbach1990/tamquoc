// Stand every frame of the named animations on one ground line: a sheet whose frames were drawn at different
// heights in their cells (the art server's variants do that) makes the figure hop as it stands or walks.
// Each frame is moved down so that its lowest pixel is where the lowest of them all is. Rewrites sheet.png.
//   node tamquoc/tools/ground.mjs <folder with sheet.png + sheet.json> [anim ...]     (default: idle walk attack)
// Run it on the downloaded folder before tools/pull.ps1 -From. Not for animations that leave the ground (die).
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readPNG } from "../../demo/lib.mjs";
import { encodePNG } from "../../.agents/skills/pixelfx/tools/lib/png.mjs";
import { bbox } from "../src/spritemeta.js";

const [dir, ...named] = process.argv.slice(2), anims = named.length ? named : ["idle", "walk", "attack"];
const json = JSON.parse(readFileSync(join(dir, "sheet.json"), "utf8")), png = readPNG(join(dir, "sheet.png"));
const src = new Uint8Array(png.px.buffer, png.px.byteOffset, png.w * png.h * 4), out = Uint8ClampedArray.from(src);
const frames = json.meta.frameTags.filter((t) => anims.includes(t.name)).flatMap((t) => json.frames.slice(t.from, t.to + 1).map((f) => f.frame));
const boxes = frames.map((f) => bbox(src, png.w, f)), ground = Math.max(...boxes.filter(Boolean).map((b) => b.y1));
const moved = [];
frames.forEach((f, i) => {
  const b = boxes[i], down = b ? ground - b.y1 : 0;
  moved.push(down);
  if (!down) return;
  for (let y = f.h - 1; y >= 0; y--) for (let x = 0; x < f.w; x++) {
    const to = ((f.y + y) * png.w + f.x + x) * 4, from = ((f.y + y - down) * png.w + f.x + x) * 4;
    for (let c = 0; c < 4; c++) out[to + c] = y >= down ? src[from + c] : 0;
  }
});
writeFileSync(join(dir, "sheet.png"), encodePNG(png.w, png.h, out));
console.log(`${anims.join(", ")}: ground at row ${ground}; moved down by ${moved.join(",")} px`);
