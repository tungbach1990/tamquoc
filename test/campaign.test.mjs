// node --test tamquoc/test   (the roster, the campaign, progress, and whether the campaign can be won)
import { test } from "node:test";
import assert from "node:assert/strict";
import { simulate, autoPlace, teamError, power } from "../src/battle.js";
import { GENERALS, GENERAL_IDS, KINGDOMS, TYPES, SHAPES, FX } from "../src/data/generals.js";
import { FORMATIONS } from "../src/data/formations.js";
import { campaign, STARTERS, recruitsOf } from "../src/data/campaign.js";
import { newProfile, applyWin, setLineup, teamOf, formationsOf, stagesOf, load, save, further, xpNext, MAX_LVL, KEY } from "../src/profile.js";

const KS = ["thuc", "nguy", "ngo"];
const foesOf = (s) => ({ formation: s.formation, units: s.foes });
const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) } };

test("roster: 52 generals, ten per kingdom, two gods, twenty with no kingdom; ids unique, data whole", () => {
  assert.equal(GENERAL_IDS.length, 52);
  assert.equal(new Set(GENERAL_IDS).size, 52);
  const count = (k) => GENERAL_IDS.filter((id) => GENERALS[id].k === k).length;
  assert.deepEqual([count("thuc"), count("nguy"), count("ngo"), count("than"), count("none")], [10, 10, 10, 2, 20]);
  for (const g of Object.values(GENERALS)) {
    assert.match(g.id, /^[a-z]+$/, g.id);
    assert.ok(KINGDOMS[g.k] && TYPES[g.type] && SHAPES[g.tactic.shape], g.id);
    assert.ok(g.tactic.fx === undefined || FX[g.tactic.fx], g.id);
    for (const s of [g.wu, g.tri, g.thong]) assert.ok(s >= 1 && s <= 100, g.id);
  }
});

test("campaign: 30 stages for each kingdom, every foe real and inside its formation, levels rising", () => {
  for (const k of KS) {
    const stages = campaign(k);
    assert.equal(stages.length, 30);
    assert.equal(new Set(stages.map((s) => s.id)).size, 30);
    stages.forEach((s, i) => {
      assert.equal(s.index, i);
      assert.equal(teamError(foesOf(s)), null, `${k} ${s.id}`);
      assert.ok(FORMATIONS[s.formation]);
      for (const r of s.rewards) assert.ok(GENERALS[r], `${k} ${s.id} reward ${r}`);
      if (i) assert.ok(s.lvl >= stages[i - 1].lvl);
    });
    // chapters 4 and 5 are the other two kingdoms, and only them
    for (const s of stages.filter((s) => s.ch === 3 || s.ch === 4)) for (const f of s.foes) assert.ok(KS.includes(GENERALS[f.gid].k) && GENERALS[f.gid].k !== k, `${k} ${s.id}`);
  }
  assert.throws(() => campaign("none"));
});

test("every general of the player's kingdom, every lone one and both gods can be won; the enemy kingdoms' can't", () => {
  for (const k of KS) {
    const got = new Set([...STARTERS[k], ...campaign(k).flatMap((s) => s.rewards)]);
    for (const g of Object.values(GENERALS)) assert.equal(got.has(g.id), g.k === k || g.k === "none" || g.k === "than", `${k}: ${g.id}`);
    assert.equal(recruitsOf(k).length, 7);
  }
});

test("a new profile: three starters at level 1 in a lineup that can fight, two formations open", () => {
  for (const k of KS) {
    const p = newProfile(k);
    assert.deepEqual(Object.keys(p.owned), STARTERS[k]);
    assert.equal(teamError(teamOf(p)), null);
    assert.deepEqual(formationsOf(p), ["phongthi", "ngulan"]);
  }
  assert.throws(() => newProfile("than"));
});

test("winning: experience and levels for those who fought, recruits and the next stage only the first time", () => {
  const p = newProfile("thuc"), s0 = stagesOf(p)[0];
  assert.throws(() => applyWin(p, 1), /chưa mở/);
  const first = applyWin(p, 0);
  assert.equal(p.cleared, 1);
  assert.deepEqual(first.recruits, s0.rewards);
  assert.ok(p.owned[s0.rewards[0]]);
  assert.ok(s0.xp >= xpNext(1), "the first win is a level");
  assert.deepEqual(first.levelUps.map((l) => l.gid).sort(), [...STARTERS.thuc].sort());
  assert.equal(p.owned.liubei.lvl, 2);
  assert.equal(p.owned[s0.rewards[0]].xp, 0, "a recruit who didn't fight gains nothing");
  const again = applyWin(p, 0);
  assert.deepEqual(again.recruits, []); assert.equal(p.cleared, 1);
  // five stages in: a third formation
  for (let i = 1; i < 5; i++) applyWin(p, i);
  assert.deepEqual(formationsOf(p), ["phongthi", "ngulan", "nhanhanh"]);
  // the level cap holds
  p.owned.liubei = { lvl: MAX_LVL - 1, xp: 0 };
  for (let i = 0; i < 40; i++) applyWin(p, 4);
  assert.equal(p.owned.liubei.lvl, MAX_LVL); assert.equal(p.owned.liubei.xp, 0);
});

test("lineup: only owned generals, open formations, legal slots", () => {
  const p = newProfile("thuc");
  assert.throws(() => setLineup(p, "batquai", autoPlace("batquai", STARTERS.thuc)), /chưa mở/);
  assert.throws(() => setLineup(p, "ngulan", [{ gid: "lubu", slot: 0 }]), /chưa có/);
  assert.throws(() => setLineup(p, "ngulan", [{ gid: "liubei", slot: 1 }]), /không thuộc/);
  assert.throws(() => setLineup(p, "ngulan", []), /chưa có tướng nào/);
  setLineup(p, "ngulan", [{ gid: "zhangfei", slot: 0 }, { gid: "liubei", slot: 4 }]);
  assert.equal(p.formation, "ngulan"); assert.equal(p.lineup.length, 2);
});

test("save and load: the same profile back; nothing saved or rubbish saved gives null; a broken lineup is rebuilt", () => {
  const store = memory(), p = newProfile("ngo");
  assert.equal(load(store), null);
  applyWin(p, 0); save(store, p);
  assert.deepEqual(load(store), p);
  store.setItem(KEY, "{oops"); assert.equal(load(store), null);
  store.setItem(KEY, JSON.stringify({ ...p, v: 99 })); assert.equal(load(store), null);
  store.setItem(KEY, JSON.stringify({ ...p, lineup: [{ gid: "sunce", slot: 0 }, { gid: "ghost", slot: 4 }], formation: "phongthi" }));
  const fixed = load(store);
  assert.equal(teamError(teamOf(fixed)), null);
});

test("two saves of one player: the one that has gone further is played", () => {
  const fresh = newProfile("thuc"), ahead = newProfile("thuc"); applyWin(ahead, 0);
  assert.equal(further(fresh, ahead), ahead); assert.equal(further(ahead, fresh), ahead);
  assert.equal(further(null, ahead), ahead); assert.equal(further(fresh, null), fresh); assert.equal(further(null, null), null);
  // the same stage reached: the one that trained more
  const trained = structuredClone(ahead); applyWin(trained, 0);
  assert.equal(trained.cleared, ahead.cleared);
  assert.equal(further(ahead, trained), trained); assert.equal(further(trained, ahead), trained);
  // a tie keeps the first (this device's)
  const twin = structuredClone(ahead);
  assert.equal(further(ahead, twin), ahead);
});

test("Telegram: outside it nothing is kept; inside, the save goes to CloudStorage and comes back; a slow or failing cloud gives null", async () => {
  const { inTelegram, cloudSave, cloudLoad, cloudClear } = await import("../src/telegram.js");
  delete globalThis.Telegram;
  assert.equal(inTelegram(), false); assert.equal(await cloudSave("x"), false); assert.equal(await cloudLoad(), null);
  // the Telegram script is loaded in an ordinary browser too, with no init data: still "outside"
  const kept = new Map();
  const CloudStorage = { setItem: (k, v, cb) => { kept.set(k, v); cb(null, true) }, getItem: (k, cb) => cb(null, kept.get(k) ?? ""), removeItem: (k, cb) => { kept.delete(k); cb(null, true) } };
  globalThis.Telegram = { WebApp: { initData: "", CloudStorage, isVersionAtLeast: () => true } };
  assert.equal(inTelegram(), false);
  globalThis.Telegram.WebApp.initData = "user=1";
  assert.equal(inTelegram(), true);
  // a whole campaign's save fits in one value
  const p = newProfile("nguy"), stages = stagesOf(p);
  for (let i = 0; i < stages.length; i++) { p.cleared = i; applyWin(p, i) }
  const text = JSON.stringify(p);
  assert.ok(text.length < 4096, `a full save is ${text.length} characters`);
  assert.equal(await cloudSave(text), true);
  assert.deepEqual(load({ getItem: () => kept.get("tamquoc") }), load({ getItem: () => text }));
  assert.equal(await cloudLoad(), text);
  assert.equal(await cloudSave("x".repeat(5000)), false); assert.equal(await cloudLoad(), text, "an oversize save leaves the old one");
  assert.equal(await cloudClear(), true); assert.equal(await cloudLoad(), null);
  // too old a client
  globalThis.Telegram.WebApp.isVersionAtLeast = () => false; assert.equal(inTelegram(), false);
  globalThis.Telegram.WebApp.isVersionAtLeast = () => true;
  CloudStorage.getItem = (k, cb) => cb("boom"); assert.equal(await cloudLoad(), null);
  CloudStorage.getItem = () => {}; assert.equal(await cloudLoad(20), null, "no answer in time");
  delete globalThis.Telegram;
});

// ---- can it be won? a simple player: the five strongest, seated by autoPlace, in the first formation ----
function bestLineup(p) {
  const five = Object.keys(p.owned).sort((a, b) => power(b, p.owned[b].lvl) - power(a, p.owned[a].lvl)).slice(0, 5);
  setLineup(p, "phongthi", autoPlace("phongthi", five));
}

test("balance: stage 1 is a walk; the last stage crushes a level-1 army", () => {
  for (const k of KS) {
    const p = newProfile(k), stages = stagesOf(p);
    let wins = 0;
    for (let seed = 1; seed <= 50; seed++) wins += simulate(teamOf(p), foesOf(stages[0]), seed).winner === 0;
    assert.ok(wins >= 45, `${k}: ${wins}/50 on stage 1`);
    for (let seed = 1; seed <= 20; seed++) assert.equal(simulate(teamOf(p), foesOf(stages[29]), seed).winner, 1, `${k} beat the last stage at level 1`);
  }
});

test("balance: each kingdom wins the whole campaign in order, replaying an old stage at most 3 times per new one", () => {
  for (const k of KS) {
    const p = newProfile(k), stages = stagesOf(p);
    let seed = 1;
    for (let i = 0; i < stages.length; i++) {
      for (let tries = 0; ; tries++) {
        bestLineup(p);
        if (simulate(teamOf(p), foesOf(stages[i]), seed++).winner === 0) { applyWin(p, i); break }
        assert.ok(tries < 3, `${k}: stuck on ${stages[i].id} (${stages[i].name}) with levels ${p.lineup.map((u) => p.owned[u.gid].lvl)}`);
        // train on the last stage won
        if (simulate(teamOf(p), foesOf(stages[i - 1]), seed++).winner === 0) applyWin(p, i - 1);
      }
    }
    assert.equal(p.cleared, 30);
    assert.equal(formationsOf(p).length, 8);
    assert.equal(Object.keys(p.owned).length, 32, "ten of the kingdom, twenty lone generals, two gods");
  }
});
