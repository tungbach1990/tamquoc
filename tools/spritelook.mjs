// See one frame of a sheet as text, for whoever can't look at the picture: letters by colour.
//   node tamquoc/tools/spritelook.mjs beasts/shenlong [anim=idle] [frame=0] [cols=100]
// Letters: g G green (dark, bright) · b B blue · Y gold · W white/ivory · c pale mint · R red · d dark · o other.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readPNG } from "../../demo/lib.mjs";
import { analyze } from "../src/spritemeta.js";

const [path, anim = "idle", frame = "0", colsArg = "100"] = process.argv.slice(2);
const dir = join(dirname(fileURLToPath(import.meta.url)), "../assets", path.includes("/") ? path : `generals/${path}`);
const json = JSON.parse(readFileSync(join(dir, "sheet.json"), "utf8")), png = readPNG(join(dir, "sheet.png")), d = new Uint8Array(png.px.buffer);
const s = analyze(d, png.w, json), t = s.tags[anim];
if (!t) throw new Error(`no animation "${anim}": ${Object.keys(s.tags).join(", ")}`);
const f = s.frames[Math.min(t.to, t.from + +frame)], cols = Math.min(+colsArg, f.w), cw = f.w / cols, ch = cw * 2;
console.log(`${path} ${anim} #${frame}: frame ${f.w}x${f.h}, figure ${s.w}x${s.h}; animations: ${Object.entries(s.tags).map(([n, r]) => `${n} ${r.to - r.from + 1}`).join(", ")}`);
for (let r = 0; r * ch < f.h; r++) {
  let line = "";
  for (let c = 0; c < cols; c++) {
    let R = 0, G = 0, B = 0, A = 0, n = 0;
    for (let y = Math.floor(r * ch); y < Math.min(f.h, (r + 1) * ch); y++) for (let x = Math.floor(c * cw); x < Math.min(f.w, (c + 1) * cw); x++) { const i = ((f.y + y) * png.w + f.x + x) * 4, a = d[i + 3] / 255; R += d[i] * a; G += d[i + 1] * a; B += d[i + 2] * a; A += a; n++ }
    if (!n || A / n < 0.4) { line += " "; continue }
    R /= A; G /= A; B /= A;
    line += G > 225 && G - R > 25 && B > 170 ? "c" : R > 215 && G > 215 && B > 170 ? "W" : R > 175 && G > 135 && B < 150 && R > B * 1.4 ? "Y" : R > 110 && G < R * 0.6 && B < R * 0.7 ? "R"
      : G > R * 1.25 && G > B * 1.1 ? (G > 140 ? "G" : "g") : B > R * 1.25 && B > G * 1.05 ? (B > 140 ? "B" : "b") : Math.max(R, G, B) < 80 ? "d" : "o";
  }
  console.log(line.replace(/\s+$/, ""));
}
