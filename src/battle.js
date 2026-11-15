// The battle, simulated whole: no DOM, no clock. simulate(a, b, seed) plays side a (the attacker, left)
// against side b (the defender, right) and returns the list of events the view replays.
//
// A team is { formation, units: [{ gid, slot, lvl, morale? }] }. A unit's id is side*9 + slot. `morale` sets
// what a general starts with instead of the usual 50 (the tactic preview starts its general at 100).

import { GENERALS } from "./data/generals.js";
import { FORMATIONS } from "./data/formations.js";

/** Who acts when: front column first, top row first; in each slot the attacker's unit, then the defender's. */
export const ORDER = [0, 3, 6, 1, 4, 7, 2, 5, 8];
export const MAX_ROUNDS = 30;
export const SHAPE_MULT = { single: 2.2, row: 1.3, col: 1.3, all: 0.8 };
const DMG_K = 4;            // scales every blow: a plain hit takes about a fifth of an equal general's troops
const MORALE_START = 50, MORALE_GAIN = 25, MORALE_FULL = 100;

/** mulberry32: a seeded random stream in [0, 1). */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const maxHp = (g, lvl) => 200 + g.thong * 8 + lvl * 40;
/** A rough strength, for sorting generals and auto lineups. */
export const power = (gid, lvl) => { const g = GENERALS[gid]; return Math.round((Math.max(g.wu, g.tri) + g.thong) * (1 + 0.05 * lvl)) };
const rowOf = (slot) => (slot / 3) | 0, colOf = (slot) => slot % 3;

/** Why a team can't take the field, or null when it can. */
export function teamError(team) {
  const f = FORMATIONS[team?.formation];
  if (!f) return "trận hình không tồn tại";
  if (!team.units?.length) return "chưa có tướng nào ra trận";
  if (team.units.length > f.slots.length) return "quá 5 tướng";
  const slots = new Set(), gids = new Set();
  for (const u of team.units) {
    if (!GENERALS[u.gid]) return `không có tướng ${u.gid}`;
    if (!f.slots.includes(u.slot)) return `ô ${u.slot} không thuộc trận ${f.name}`;
    if (slots.has(u.slot)) return `ô ${u.slot} có hai tướng`;
    if (gids.has(u.gid)) return `${GENERALS[u.gid].name} ra trận hai lần`;
    slots.add(u.slot); gids.add(u.gid);
  }
  return null;
}

/** Seat generals in a formation: foot and cavalry toward the front, strategists and archers behind. */
export function autoPlace(formation, gids) {
  const rank = { B: 0, K: 1, M: 2, C: 3 };
  const slots = [...FORMATIONS[formation].slots].sort((a, b) => colOf(a) - colOf(b) || Math.abs(rowOf(a) - 1) - Math.abs(rowOf(b) - 1) || a - b);
  const order = gids.slice(0, slots.length).map((gid, i) => ({ gid, i })).sort((a, b) => rank[GENERALS[a.gid].type] - rank[GENERALS[b.gid].type] || a.i - b.i);
  return order.map(({ gid }, i) => ({ gid, slot: slots[i] }));
}

function muster(side, team) {
  const err = teamError(team);
  if (err) throw new Error(`bên ${side ? "thủ" : "công"}: ${err}`);
  const bonus = { atk: 0, tactic: 0, guard: 0, plot: 0, crit: 0, dodge: 0, morale: 0, hp: 0, ...FORMATIONS[team.formation].bonus };
  return team.units.map((u) => {
    const g = GENERALS[u.gid], lvl = u.lvl ?? 1, max = Math.round(maxHp(g, lvl) * (1 + bonus.hp));
    return { id: side * 9 + u.slot, side, slot: u.slot, gid: u.gid, g, lvl, max, hp: max, morale: u.morale ?? MORALE_START + bonus.morale, stun: 0, bonus };
  });
}

/** The enemy a unit goes for: the nearest in its own row, else in the closest row that has anyone; archers take the farthest. */
export function pickTarget(unit, foes) {
  const r = rowOf(unit.slot);
  for (const row of [r, r - 1, r + 1, r - 2, r + 2]) {
    if (row < 0 || row > 2) continue;
    const there = foes.filter((f) => rowOf(f.slot) === row).sort((a, b) => colOf(a.slot) - colOf(b.slot));
    if (there.length) return unit.g.type === "C" ? there[there.length - 1] : there[0];
  }
  return null;
}

/** Everyone a tactic of this shape lands on, the target first. */
export function shapeTargets(shape, target, foes) {
  const rest = shape === "row" ? foes.filter((f) => rowOf(f.slot) === rowOf(target.slot))
    : shape === "col" ? foes.filter((f) => colOf(f.slot) === colOf(target.slot))
    : shape === "all" ? foes : [];
  return [target, ...rest.filter((f) => f !== target)];
}

export function simulate(a, b, seed = 1, maxRounds = MAX_ROUNDS) {
  const R = rng(seed);
  const units = [...muster(0, a), ...muster(1, b)];
  const start = units.map(({ id, side, slot, gid, lvl, max, hp, morale }) => ({ id, side, slot, gid, lvl, max, hp, morale }));
  const events = [];
  const living = (side) => units.filter((u) => u.side === side && u.hp > 0);

  function strike(src, dst, mult, isTactic) {
    const plot = src.g.type === "M";
    if (R() < 0.05 + dst.bonus.dodge) return { id: dst.id, dodge: true, dmg: 0, hp: dst.hp };
    let d = (plot ? src.g.tri : src.g.wu) * mult * (0.5 + 0.5 * src.hp / src.max) * 100 / (100 + (plot ? dst.g.tri : dst.g.thong)) * (1 + 0.03 * src.lvl) * (0.9 + 0.2 * R()) * DMG_K;
    d *= isTactic ? 1 + src.bonus.tactic : (1 + src.bonus.atk) * (src.g.type === "K" ? 1.2 : 1);
    if (plot) d *= 1 + src.bonus.plot;
    else if (dst.g.type === "B") d *= 0.8;
    d *= 1 - dst.bonus.guard;
    const crit = R() < 0.1 + src.bonus.crit;
    if (crit) d *= 1.5;
    d = Math.max(1, Math.round(d));
    dst.hp = Math.max(0, dst.hp - d);
    return { id: dst.id, dmg: d, crit, hp: dst.hp, dead: dst.hp === 0 };
  }
  const mend = (u, part) => { const n = Math.min(u.max - u.hp, Math.round(u.max * part)); u.hp += n; return { id: u.id, amount: n, hp: u.hp } };

  function act(u) {
    if (u.stun > 0) { u.stun--; events.push({ t: "skip", id: u.id }); return }
    const foes = living(1 - u.side), friends = living(u.side);
    const ev = { t: "act", id: u.id, tactic: null, shape: null, hits: [], heals: [] };
    if (u.morale >= MORALE_FULL) {
      const { name, shape, fx } = u.g.tactic;
      ev.tactic = name; ev.shape = shape; u.morale = 0;
      if (shape === "heal") ev.heals = friends.map((f) => mend(f, 0.2));
      else {
        const target = pickTarget(u, foes);
        for (const f of shapeTargets(shape, target, foes)) {
          const h = strike(u, f, SHAPE_MULT[shape], true);
          if (!h.dodge && !h.dead) {
            if (fx === "stun" && f === target) { f.stun = 1; h.stun = true }
            if (fx === "demoralize") { f.morale = Math.max(0, f.morale - 25); h.morale = f.morale }
          }
          ev.hits.push(h);
        }
        if (fx === "heal") ev.heals = [mend(friends.reduce((m, f) => (f.hp / f.max < m.hp / m.max ? f : m)), 0.15)];
      }
    } else {
      ev.hits.push(strike(u, pickTarget(u, foes), 1, false));
      u.morale = Math.min(MORALE_FULL, u.morale + MORALE_GAIN);
    }
    ev.morale = u.morale;
    events.push(ev);
  }

  let winner = null, round = 0;
  fight: for (round = 1; round <= maxRounds; round++) {
    events.push({ t: "round", n: round });
    for (const slot of ORDER) for (const side of [0, 1]) {
      const u = units.find((x) => x.side === side && x.slot === slot);
      if (!u || u.hp <= 0) continue;
      act(u);
      if (!living(0).length) { winner = 1; break fight }
      if (!living(1).length) { winner = 0; break fight }
    }
  }
  if (winner === null) { winner = 1; round = maxRounds }   // out of rounds: the defender holds
  events.push({ t: "end", winner, rounds: round });
  return { units: start, events, winner, rounds: round };
}
