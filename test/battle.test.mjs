// node --test tamquoc/test
import { test } from "node:test";
import assert from "node:assert/strict";
import { simulate, pickTarget, shapeTargets, autoPlace, teamError, maxHp, MAX_ROUNDS, ORDER } from "../src/battle.js";
import { GENERALS } from "../src/data/generals.js";
import { FORMATIONS, FORMATION_ORDER } from "../src/data/formations.js";

const team = (formation, ...units) => ({ formation, units: units.map(([gid, slot, lvl = 1]) => ({ gid, slot, lvl })) });
const unit = (gid, slot) => ({ slot, g: GENERALS[gid] });
const acts = (r, id) => r.events.filter((e) => e.t === "act" && e.id === id);

test("same seed, same battle; another seed, another battle", () => {
  const a = team("phongthi", ["liubei", 4], ["guanyu", 3], ["zhangfei", 1]), b = team("ngulan", ["caocao", 0], ["xuchu", 3], ["xiahoudun", 6]);
  assert.deepEqual(simulate(a, b, 7), simulate(a, b, 7));
  assert.notDeepEqual(simulate(a, b, 7).events, simulate(a, b, 8).events);
});

test("targets: the nearest in the same row, then the closest row with anyone; archers take the farthest", () => {
  const foes = [unit("xuchu", 3), unit("caocao", 5), unit("dianwei", 7)];
  assert.equal(pickTarget(unit("zhangfei", 4), foes).slot, 3, "same row, front first");
  assert.equal(pickTarget(unit("huangzhong", 4), foes).slot, 5, "an archer shoots the back of the row");
  assert.equal(pickTarget(unit("zhangfei", 1), foes).slot, 3, "row 0 is empty: the next row down");
  assert.equal(pickTarget(unit("zhangfei", 1), [unit("dianwei", 7)]).slot, 7, "two rows away when nothing is closer");
  assert.equal(pickTarget(unit("zhangfei", 7), [unit("xuchu", 2), unit("caocao", 5)]).slot, 5, "the adjacent row before the far one");
});

test("tactic shapes land on the right slots", () => {
  const foes = [0, 1, 3, 4, 7].map((s) => unit("xuchu", s)), t = foes[0];
  const slots = (shape) => shapeTargets(shape, t, foes).map((f) => f.slot).sort();
  assert.deepEqual(slots("single"), [0]);
  assert.deepEqual(slots("row"), [0, 1]);
  assert.deepEqual(slots("col"), [0, 3]);
  assert.deepEqual(slots("all"), [0, 1, 3, 4, 7]);
});

test("morale: two plain attacks, then the tactic, then morale is back to 0", () => {
  const r = simulate(team("phongthi", ["caoren", 4, 30]), team("phongthi", ["liubiao", 4, 30]), 3);
  const mine = acts(r, 4);
  assert.deepEqual(mine.slice(0, 3).map((e) => e.tactic), [null, null, "Bát Môn Kim Tỏa"]);
  assert.deepEqual(mine.slice(0, 4).map((e) => e.morale), [75, 100, 0, 25]);
});

test("Thất Tinh starts with 75 morale: the tactic comes one action sooner", () => {
  const r = simulate(team("thattinh", ["caoren", 4, 30]), team("phongthi", ["liubiao", 4, 30]), 3);
  assert.deepEqual(acts(r, 4).slice(0, 2).map((e) => e.tactic), [null, "Bát Môn Kim Tỏa"]);
});

test("a stun costs exactly one action", () => {
  // Zhang Fei's roar stuns its target; find a battle where it landed
  for (let seed = 1; seed < 50; seed++) {
    const r = simulate(team("phongthi", ["zhangfei", 4, 30]), team("phongthi", ["caoren", 4, 30]), seed);
    const i = r.events.findIndex((e) => e.t === "act" && e.id === 4 && e.hits.some((h) => h.stun));
    if (i < 0) continue;
    const after = r.events.slice(i + 1).filter((e) => e.id === 13);
    assert.equal(after[0].t, "skip", "the stunned general loses its next action");
    if (after[1]) assert.equal(after[1].t, "act", "and acts again the time after");
    return;
  }
  assert.fail("the stun never landed in 50 battles");
});

test("healing never goes over the full troop count", () => {
  for (let seed = 1; seed < 30; seed++) {
    const r = simulate(team("phongthi", ["liubei", 4, 10], ["huatuo", 3, 10], ["zhoutai", 1, 10]), team("phongthi", ["xuchu", 4, 10], ["dianwei", 1, 10]), seed);
    const max = Object.fromEntries(r.units.map((u) => [u.id, u.max]));
    for (const e of r.events) for (const h of e.heals ?? []) { assert.ok(h.hp <= max[h.id]); assert.ok(h.amount >= 0) }
  }
});

test("a battle ends with a winner; out of rounds, the defender holds", () => {
  const r = simulate(team("phongthi", ["lubu", 4, 30]), team("phongthi", ["huatuo", 4, 1]), 1);
  assert.equal(r.winner, 0); assert.equal(r.events.at(-1).t, "end");
  assert.ok(r.events.some((e) => e.hits?.some((h) => h.dead)));
  const slow = simulate(team("phongthi", ["caoren", 4, 30]), team("phongthi", ["caoren", 4, 30]), 1, 2);
  assert.equal(slow.rounds, 2); assert.equal(slow.winner, 1);
  assert.equal(slow.events.filter((e) => e.t === "round").length, 2);
  assert.equal(MAX_ROUNDS, 30);
});

test("the dead don't act, and nobody hits the dead", () => {
  const r = simulate(team("phongthi", ["guanyu", 3, 8], ["zhangfei", 4, 8], ["zhaoyun", 5, 8]), team("ngulan", ["caocao", 0, 8], ["xuchu", 3, 8], ["dianwei", 6, 8]), 11);
  const dead = new Set();
  for (const e of r.events) {
    if (e.t !== "act") continue;
    assert.ok(!dead.has(e.id), "a dead general acted");
    for (const h of e.hits) { assert.ok(!dead.has(h.id), "a dead general was hit"); if (h.dead) dead.add(h.id) }
  }
});

test("formations: five different slots each, eight of them, and a team outside its slots is refused", () => {
  assert.equal(FORMATION_ORDER.length, 8);
  assert.deepEqual([...FORMATION_ORDER].sort(), Object.keys(FORMATIONS).sort());
  for (const [id, f] of Object.entries(FORMATIONS)) {
    assert.equal(new Set(f.slots).size, 5, id);
    assert.ok(f.slots.every((s) => Number.isInteger(s) && s >= 0 && s < 9), id);
    assert.ok(ORDER.includes(f.slots[0]));
  }
  assert.match(teamError(team("phongthi", ["liubei", 0])), /không thuộc trận/);
  assert.match(teamError(team("phongthi", ["liubei", 4], ["guanyu", 4])), /hai tướng/);
  assert.match(teamError(team("phongthi", ["liubei", 4], ["liubei", 3])), /hai lần/);
  assert.equal(teamError(team("phongthi", ["liubei", 4])), null);
  assert.throws(() => simulate(team("phongthi", ["liubei", 0]), team("phongthi", ["caocao", 4])));
});

test("autoPlace: fighters in front of strategists and archers, every slot inside the formation", () => {
  for (const f of FORMATION_ORDER) {
    const placed = autoPlace(f, ["zhugeliang", "huangzhong", "zhangfei", "guanyu", "liubei"]);
    assert.equal(teamError({ formation: f, units: placed }), null, f);
    const col = Object.fromEntries(placed.map((u) => [u.gid, u.slot % 3]));
    assert.ok(col.zhangfei <= col.zhugeliang && col.liubei <= col.huangzhong, f);
  }
});

// the same duel many times, with and without the formation's bonus
const mean = (fn, n = 300) => { let s = 0; for (let i = 1; i <= n; i++) s += fn(i); return s / n };
const firstHit = (a, b, pick) => (seed) => { const e = simulate(a, b, seed).events.find(pick); return e.hits[0].dodge ? 0 : e.hits[0].dmg };
test("formation bonuses do what they say", () => {
  // one against one, each in the first slot of its formation; unit ids under 9 are the attacker's
  const plainAct = (e) => e.t === "act" && e.id < 9 && !e.tactic, foeAct = (e) => e.t === "act" && e.id >= 9;
  const me = (f, gid = "guanyu") => team(f, [gid, FORMATIONS[f].slots[0], 10]), foe = (f) => team(f, ["caoren", FORMATIONS[f].slots[0], 10]);
  // the baseline is a formation whose bonus doesn't touch the number measured (Trường Xà helps only strategists)
  const base = mean(firstHit(me("truongxa"), foe("phongthi"), plainAct));
  assert.ok(mean(firstHit(me("phongthi"), foe("phongthi"), plainAct)) > base * 1.1, "Phong Thỉ: harder plain attacks");
  assert.ok(mean(firstHit(me("ngulan"), foe("phongthi"), foeAct)) < mean(firstHit(me("truongxa"), foe("phongthi"), foeAct)) * 0.95, "Ngư Lân: takes less");
  const plot = (f) => mean(firstHit(me(f, "zhugeliang"), foe("phongthi"), plainAct));
  assert.ok(plot("truongxa") > plot("nhanhanh") * 1.1, "Trường Xà: stronger strategists");
  const tactic = (f) => mean(firstHit(me(f), team("phongthi", ["caoren", 4, 30]), (e) => e.t === "act" && e.id < 9 && e.tactic));
  assert.ok(tactic("nhanhanh") > tactic("truongxa") * 1.1, "Nhạn Hành: stronger tactics");
  const rate = (f, key, side) => mean((seed) => { const e = simulate(me(f), foe(f === "batquai" ? "phongthi" : "ngulan"), seed).events.find(side); return e.hits[0][key] ? 1 : 0 }, 600);
  assert.ok(rate("yennguyet", "crit", plainAct) > 0.19, "Yển Nguyệt: more crits");
  assert.ok(rate("batquai", "dodge", foeAct) > 0.14, "Bát Quái: more dodges");
  const hp = (f) => simulate(me(f), foe("phongthi"), 1).units[0].max;
  assert.equal(hp("chuyhinh"), Math.round(maxHp(GENERALS.guanyu, 10) * 1.1), "Chùy Hình: more troops");
});

test("troop types: foot take less from blades, cavalry hit harder, strategists strike at wits", () => {
  const plainAct = (e) => e.t === "act" && e.id === 4 && !e.tactic;
  const hit = (gid, foe) => mean(firstHit(team("ngulan", [gid, 4, 10]), team("ngulan", [foe, 4, 10]), plainAct));
  // Xu Chu (foot, thống 68) against Ma Chao (cavalry, thống 80): the foot soldier still takes less
  assert.ok(hit("zhangfei", "xuchu") < hit("zhangfei", "machao"));
  // Zhuge Liang's blow is against trí: Xu Chu (35) suffers far more than Sima Yi (98)
  assert.ok(hit("zhugeliang", "xuchu") > hit("zhugeliang", "simayi") * 1.3);
});
