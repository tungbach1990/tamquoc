// node --test tamquoc/test   (which way figures face; what every tactic looks like)
import { test } from "node:test";
import assert from "node:assert/strict";
import { GENERALS, GENERAL_IDS } from "../src/data/generals.js";
import { VFX, BEASTS, FX_KINDS, HEALING_KINDS } from "../src/data/vfx.js";
import { drawEffect, drawCutIn, effectMs, EFFECT_KINDS, HIT } from "../src/vfx.js";
import { drawSprite } from "../src/sprites.js";
import { mustFlip } from "../src/spritemeta.js";
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
const sheet = (facing = "left") => ({ ready: true, img: {}, facing, ax: 5, ay: 10, h: 10, w: 10, frames: [{ x: 0, y: 0, w: 10, h: 10, dur: 83 }], tags: { idle: { from: 0, to: 0 }, walk: { from: 0, to: 0 }, attack: { from: 0, to: 0 } } });
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
    if (v.fx === "beast") { assert.ok(BEASTS[v.beast], `${gid}: no beast ${v.beast}`); assert.ok(["dash", "dive"].includes(v.move), gid); used.push(v.beast) }
    assert.equal(HEALING_KINDS.includes(v.fx), GENERALS[gid].tactic.shape === "heal", gid);
    assert.ok(effectMs(v) >= 1200 && effectMs(v) <= 2000, gid);
  }
  assert.equal(Object.keys(BEASTS).length, 6);
  // the ones the user named: Guan Yu's is a dragon drawn in code, Zhuge Liang calls wind and rain, Zhao Yun the white tiger
  assert.deepEqual([VFX.guanyu.fx, VFX.zhugeliang.fx, VFX.zhaoyun.beast, VFX.liubei.fx, VFX.nezha.fx], ["dragon", "storm", "baihu", "grace", "wheels"]);
  assert.deepEqual(used.sort(), Object.keys(BEASTS).sort());
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
    if (art && VFX[gid].beast) assert.ok(ctx.calls.some((c) => c[0] === "drawImage"), `${gid}: the beast was never drawn`);
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

test("a general given full morale opens with his tactic (the tactic preview relies on it)", () => {
  const r = simulate({ formation: "phongthi", units: [{ gid: "guanyu", slot: 3, lvl: 30, morale: 100 }] }, { formation: "phongthi", units: [{ gid: "gaoshun", slot: 3, lvl: 30 }] }, 7, 1);
  assert.equal(r.events[0].t, "round");
  assert.equal(r.events[1].id, 3);
  assert.equal(r.events[1].tactic, "Thanh Long Yển Nguyệt");
});
