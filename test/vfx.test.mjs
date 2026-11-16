// node --test tamquoc/test   (which way figures face and where they stand; what every tactic looks like)
import { test } from "node:test";
import assert from "node:assert/strict";
import { GENERALS, GENERAL_IDS } from "../src/data/generals.js";
import { VFX, BEASTS, FX_KINDS, HEALING_KINDS } from "../src/data/vfx.js";
import { drawEffect, drawCutIn, effectMs, castPose, EFFECT_KINDS, HIT } from "../src/vfx.js";
import { drawSprite } from "../src/sprites.js";
import { mustFlip, analyze } from "../src/spritemeta.js";
import { simulate } from "../src/battle.js";

/** A canvas context that draws nothing and remembers what it was asked to do. */
function fakeCtx() {
  // a real canvas also throws on a colour stop outside 0..1 or with a colour it can't read
  const calls = [], grad = { addColorStop(at, colour) { if (!(at >= 0 && at <= 1) || !/^(#[0-9a-f]{6}|rgba\(\d+,\d+,\d+,(0|1|0?\.\d+|[01]\.\d+)\))$/.test(colour)) throw new RangeError(`addColorStop(${at}, ${colour})`) } };
  // a real canvas throws on a negative radius: so does this one
  const radius = (name, ...rs) => { for (const r of rs) if (!(r >= 0)) throw new RangeError(`${name}: radius ${r}`) };
  const own = {
    calls, globalAlpha: 1, createLinearGradient: () => grad,
    createRadialGradient: (x0, y0, r0, x1, y1, r1) => { radius("createRadialGradient", r0, r1); return grad },
    arc: (x, y, r, ...rest) => { radius("arc", r); calls.push(["arc", x, y, r, ...rest]) },
    ellipse: (x, y, rx, ry, ...rest) => { radius("ellipse", rx, ry); calls.push(["ellipse", x, y, rx, ry, ...rest]) },
  };
  return new Proxy(own, { get: (t, p) => (p in t ? t[p] : (...args) => { calls.push([p, ...args]) }), set: (t, p, v) => { t[p] = v; return true } });
}
const sheet = (facing = "left") => ({ ready: true, img: {}, facing, ax: 5, ay: 10, cx: 5, cy: 5, h: 10, w: 10, frames: [{ x: 0, y: 0, w: 10, h: 10, dur: 83, ax: 5, ay: 10, k: 1 }], tags: { idle: { from: 0, to: 0 }, walk: { from: 0, to: 0 }, attack: { from: 0, to: 0 } } });
const sawNumbers = (calls) => calls.every((c) => c.slice(1).every((v) => typeof v !== "number" || Number.isFinite(v)));

test("facing: a figure drawn facing left is mirrored on the left side of the field, and not on the right", () => {
  assert.equal(mustFlip("left", true), true);     // the player's general, looking right at the enemy
  assert.equal(mustFlip("left", false), false);   // the enemy's, looking left
  assert.equal(mustFlip("right", true), false);
  assert.equal(mustFlip("right", false), true);
  const flipped = (facing, faceRight) => { const ctx = fakeCtx(); drawSprite(ctx, sheet(facing), "idle", 0, 100, 100, { scale: 2, faceRight }); return ctx.calls.find((c) => c[0] === "scale")[1] < 0 };
  assert.deepEqual([flipped("left", true), flipped("left", false), flipped("right", true), flipped("right", false)], [true, false, false, true]);
});

test("facing: no general is marked as drawn facing right unless someone looked and said so", () => {
  // every sheet from the art server faces left (tools/spritecheck.mjs measures it); a `facing` entry is an exception
  for (const g of Object.values(GENERALS)) assert.ok(g.facing === undefined || g.facing === "right", g.id);
});

test("every general has a tactic effect of a known kind; every beast is one general's; a healing tactic plays on its own line", () => {
  assert.deepEqual([...EFFECT_KINDS].sort(), [...FX_KINDS].sort());
  assert.deepEqual(Object.keys(VFX).sort(), [...GENERAL_IDS].sort());
  const used = [];
  for (const [gid, v] of Object.entries(VFX)) {
    assert.ok(FX_KINDS.includes(v.fx), gid);
    assert.match(v.c, /^#[0-9a-f]{6}$/, gid); assert.match(v.c2, /^#[0-9a-f]{6}$/, gid);
    if (v.beast) { assert.ok(BEASTS[v.beast], `${gid}: no beast ${v.beast}`); used.push(v.beast) }
    if (v.fx === "beast") assert.ok(["dash", "dive"].includes(v.move), gid);
    assert.equal(HEALING_KINDS.includes(v.fx), GENERALS[gid].tactic.shape === "heal", gid);
    assert.ok(effectMs(v) >= 1200 && effectMs(v) <= 3500, gid);
  }
  assert.equal(Object.keys(BEASTS).length, 7);
  assert.equal(VFX.guanyu.beast, "shenlong");   // the dragon is drawn in code; the name is the spirit's
  // the ones the user named: Guan Yu's is a dragon drawn in code, Zhuge Liang calls wind and rain, Zhao Yun the white tiger
  assert.deepEqual([VFX.guanyu.fx, VFX.zhugeliang.fx, VFX.zhaoyun.beast, VFX.liubei.fx, VFX.nezha.fx], ["dragon", "storm", "baihu", "grace", "wheels"]);
  assert.deepEqual(used.sort(), Object.keys(BEASTS).sort());
});

test("a sheet's faults are put right: an idle frame drawn off its place, a rider drawn bigger when he strikes", () => {
  // a sheet of cells in a row, a block for the figure in each: [left, top, width, height]
  const read = (cw, cells, tags, opts) => {
    const ch = 123, sw = cw * cells.length, rgba = new Uint8Array(sw * ch * 4);
    cells.forEach(([x0, y0, w, h], i) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) rgba[(y * sw + i * cw + x) * 4 + 3] = 255 });
    const json = { frames: cells.map((c, i) => ({ frame: { x: i * cw, y: 0, w: cw, h: ch }, duration: 83 })), meta: { frameTags: Object.entries(tags).map(([name, [from, to]]) => ({ name, from, to })) } };
    return analyze(rgba, sw, json, opts);
  };
  const still = [60, 40, 40, 70], big = [50, 30, 52, 91];                         // big: 1.3 times the size, standing lower in its cell
  const cells = [still, still, [65, 34, 40, 70], [61, 40, 40, 70], still, still, big, big], tags = { idle: [0, 3], walk: [4, 5], attack: [6, 7] };
  const feet = (s, i) => [s.frames[i].ax, s.frames[i].ay, +s.frames[i].k.toFixed(2)];
  const rider = read(167, cells, tags, { steady: true });
  assert.equal(rider.mounted, true);
  assert.deepEqual([rider.ax, rider.ay, rider.h], [80, 110, 70]);
  assert.deepEqual(feet(rider, 0), [80, 110, 1]);
  assert.deepEqual(feet(rider, 2), [85, 104, 1], "a frame drawn 5 right and 6 up stands where the others do");
  assert.deepEqual(feet(rider, 3), [80, 110, 1], "a pixel of sway is the animation's own");
  assert.deepEqual(feet(rider, 4), [80, 110, 1], "an animation of the right size is left alone");
  assert.deepEqual([feet(rider, 6), feet(rider, 7)], [[76, 121, 0.77], [76, 121, 0.77]], "the bigger rider is scaled back onto his own feet");
  assert.deepEqual(feet(read(167, cells, tags), 2), [80, 110, 1], "a beast's bob is not taken out");
  assert.deepEqual(feet(read(160, cells, tags, { steady: true }), 6), [80, 110, 1], "only riders are measured for size");
  // and a frame is drawn on its own feet at its own size
  const ctx = fakeCtx(), s = sheet(); Object.assign(s.frames[0], { ax: 7, ay: 9, k: 0.5 });
  drawSprite(ctx, s, "idle", 0, 100, 100, { scale: 2, faceRight: false });
  assert.deepEqual(ctx.calls.find((c) => c[0] === "scale"), ["scale", 1, 1]);
  assert.deepEqual(ctx.calls.find((c) => c[0] === "drawImage").slice(6, 8), [-7, -9]);
});

test("a general acts all through his tactic: he winds up, lets go by the time the blow lands, follows through", () => {
  for (const [gid, v] of Object.entries(VFX)) {
    assert.equal(castPose(v, 0).at, 0, gid); assert.deepEqual(castPose(v, 0.95), { at: 1, lean: 0, step: 0 }, gid);
    assert.ok(castPose(v, HIT).at >= 0.5 - 1e-9, `${gid}: his blow is not out when it lands`);
    for (let i = 0; i < 92; i++) {
      const p = castPose(v, i / 100), near = [0, 1, 2, 3, 4].map((j) => castPose(v, i / 100 + j * 0.03)), wide = (list) => Math.max(...list) - Math.min(...list);
      assert.ok(p.at >= 0 && p.at < 1, `${gid}: ${p.at} at ${i}%`);
      // he is never still for long: his frames move on, or he is stepping (he may come back to a pose he was in)
      if (i < 85) assert.ok(wide(near.map((q) => q.at)) > 0.02 || wide(near.map((q) => q.step)) > 4, `${gid}: he stands still from ${i}%`);
      if (v.fx !== "dragon") assert.deepEqual([p.lean, p.step], [0, 0], gid);
    }
  }
  // Guan Yu: while the dragon wheels he goes round his blade's flourish (frames 0..4 of 6, again and again) on a
  // half-rearing horse, and has not chopped (frame 5) before it stoops; then he has, and has lunged at them
  const guan = (k) => castPose(VFX.guanyu, k), frame = (k) => Math.floor(guan(k).at * 497 / 83);
  for (let k = 0.08; k < 0.52; k += 0.01) assert.ok(guan(k).lean > 0.1 && frame(k) <= 4, `whirling at ${k.toFixed(2)}: frame ${frame(k)}`);
  assert.deepEqual([0.075, 0.22, 0.23, 0.37, 0.39, 0.51].map(frame), [0, 4, 0, 4, 0, 4], "round, and round, and round again");
  for (const k of [0.55, 0.59, 0.68, 0.75]) assert.ok(guan(k).lean === 0 && guan(k).step > 20 && frame(k) === 5, `the chop at ${k}`);
  assert.equal(frame(0.62), 4, "between his two cuts the blade is up");
  assert.ok(frame(0.85) === 4 && guan(0.85).step < 20, "he lifts the blade and draws back");
});

test("the wind of Guan Yu's blade goes right round over his head, turn for turn with the dragon", () => {
  // where it is: where its trail starts, the first stroke of its widest width
  const env = { W: 540, H: 600, dir: 1, now: 0, cfg: VFX.guanyu, caster: { x: 226, y: 392, tall: 125 }, targets: [262, 392, 522].map((y) => ({ x: 390, y, tall: 100 })), beast: null };
  const point = (k) => {
    const ctx = fakeCtx(); let at = null, path = [];
    const real = { beginPath: () => (path = []), moveTo: (x, y) => path.push([x, y]), stroke: () => { if (!at && path.length === 1 && ctx.lineWidth > 9 && ctx.lineWidth < 16) at = path[0] } };
    drawEffect(new Proxy(ctx, { get: (t, p) => real[p] ?? t[p], set: (t, p, v) => { t[p] = v; return true } }), "front", k, env);
    return at;
  };
  const xs = [], ys = [];
  for (let k = 0.14; k < 0.5; k += 0.005) { const p = point(k); assert.ok(p, `no wind at ${k}`); xs.push(p[0]); ys.push(p[1]) }
  const mid = (Math.max(...xs) + Math.min(...xs)) / 2, passes = xs.filter((x, i) => i && (xs[i - 1] < mid) !== (x < mid)).length;   // times it passes over him: twice a turn
  assert.ok(Math.max(...xs) - Math.min(...xs) > 170 && Math.max(...ys) - Math.min(...ys) > 50, "a wide wheel, seen from the side");
  assert.ok(passes >= 3, `it passes over him ${passes} time(s)`);
  assert.ok(Math.max(...ys) < 392 - 125 + 40, "the wheel is over his head");
});

test("every general's effect draws from start to end, both ways round, with and without art", () => {
  for (const gid of GENERAL_IDS) for (const dir of [1, -1]) for (const art of [false, true]) {
    const heal = GENERALS[gid].tactic.shape === "heal", ctx = fakeCtx();
    const env = {
      W: 540, H: 600, cfg: VFX[gid], who: GENERALS[gid].name, tactic: GENERALS[gid].tactic.name, dir, heal, now: 0,
      caster: { x: dir > 0 ? 226 : 314, y: 392, tall: 100, s: art ? sheet() : { ready: false } },
      targets: (heal ? [[150, 262], [226, 392], [150, 522]] : [[314, 262], [390, 392], [314, 522]]).map(([x, y]) => ({ x: dir > 0 ? x : 540 - x, y, tall: 100 })),
      beast: VFX[gid].beast ? (art ? sheet() : { ready: false }) : null,
    };
    for (let i = 0; i <= 40; i++) {
      env.now = i * 30;
      drawCutIn(ctx, i / 40, env);
      drawEffect(ctx, "back", i / 40, env); drawEffect(ctx, "front", i / 40, env);
    }
    assert.ok(ctx.calls.length > 60, `${gid}: only ${ctx.calls.length} drawing calls`);
    assert.ok(sawNumbers(ctx.calls), `${gid}: a drawing call got NaN or Infinity`);
    // the blow shows: around the hit there is more on the canvas than at the very start
    const at = (k) => { const c = fakeCtx(); drawEffect(c, "front", k, env); return c.calls.length };
    assert.ok(at(HIT + 0.05) > 0, `${gid}: nothing drawn at the hit`);
    if (art && VFX[gid].fx === "beast") assert.ok(ctx.calls.some((c) => c[0] === "drawImage"), `${gid}: the beast was never drawn`);
  }
});

test("an effect with a single target, or none, still holds together", () => {
  const env = { W: 540, H: 600, dir: 1, heal: false, now: 0, who: "x", tactic: "y", caster: { x: 226, y: 392, tall: 100, s: { ready: false } }, targets: [{ x: 314, y: 392, tall: 100 }], beast: null };
  for (const fx of FX_KINDS) {
    const ctx = fakeCtx();
    for (let i = 0; i <= 20; i++) for (const layer of ["back", "front"]) drawEffect(ctx, layer, i / 20, { ...env, cfg: { fx, c: "#ff0000", c2: "#ffffff", move: "dash", big: true, heavy: true, seal: true, sand: true, giant: true, shout: "!" } });
    assert.ok(sawNumbers(ctx.calls), fx);
    const none = fakeCtx(); drawEffect(none, "front", 0.5, { ...env, targets: [], cfg: { fx, c: "#ff0000", c2: "#ffffff" } });
    assert.equal(none.calls.length, 0, fx);
  }
  // a kind nobody wrote falls back to a slash
  const ctx = fakeCtx(); drawEffect(ctx, "front", HIT + 0.05, { ...env, cfg: { fx: "nope", c: "#ff0000", c2: "#ffffff" } });
  assert.ok(ctx.calls.length > 0);
});

test("the Azure Dragon is drawn in code, head, body and legs; the same moment of it always looks the same", () => {
  const env = { W: 540, H: 600, dir: 1, now: 0, cfg: VFX.guanyu, caster: { x: 226, y: 392, tall: 100 }, targets: [{ x: 390, y: 392, tall: 100 }], beast: null };
  const draw = (k, layer, now = 0) => { const ctx = fakeCtx(); drawEffect(ctx, layer, k, { ...env, now }); return ctx.calls };
  // in its stoop it is in front of the generals: its outline, its locks of mane, its turning jaw and legs
  const pose = (k, now) => draw(k, "front", now).filter(([name]) => ["rotate", "lineTo", "quadraticCurveTo"].includes(name));
  const a = pose(0.6);
  assert.ok(a.length > 400, `only ${a.length} strokes: no dragon`);
  assert.notDeepEqual(a, pose(0.61), "it moves");
  assert.deepEqual(a, pose(0.6, 9999), "its pose comes from the effect's own time, not the clock on the wall");
  for (let i = 0; i <= 120; i++) for (const layer of ["back", "front"]) {
    const calls = draw(i / 120, layer, i * 28);
    assert.ok(sawNumbers(calls), `frame ${i}: NaN or Infinity`);
    assert.ok(!calls.some(([name]) => name === "drawImage"), "no painted art");
  }
});

test("a general given full morale opens with his tactic (the tactic preview relies on it)", () => {
  const r = simulate({ formation: "phongthi", units: [{ gid: "guanyu", slot: 3, lvl: 30, morale: 100 }] }, { formation: "phongthi", units: [{ gid: "gaoshun", slot: 3, lvl: 30 }] }, 7, 1);
  assert.equal(r.events[0].t, "round");
  assert.equal(r.events[1].id, 3);
  assert.equal(r.events[1].tactic, "Thanh Long Yển Nguyệt");
});
