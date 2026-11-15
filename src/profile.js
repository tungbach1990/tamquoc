// The player's progress: kingdom, generals owned with their levels, the lineup, stages cleared.
// Plain data; load/save take any Storage-like object (localStorage in the browser, a stub in tests).

import { GENERALS } from "./data/generals.js";
import { FORMATIONS, FORMATION_ORDER } from "./data/formations.js";
import { campaign, STARTERS, STAGES_PER_CHAPTER } from "./data/campaign.js";
import { autoPlace, teamError } from "./battle.js";

export const MAX_LVL = 30;
export const KEY = "tamquoc.profile.v1";
/** Experience to go from this level to the next. */
export const xpNext = (lvl) => 50 + lvl * 20;

export function newProfile(kingdom) {
  const mine = STARTERS[kingdom];
  if (!mine) throw new Error(`không có nước ${kingdom}`);
  return { v: 1, kingdom, owned: Object.fromEntries(mine.map((gid) => [gid, { lvl: 1, xp: 0 }])), formation: "phongthi", lineup: autoPlace("phongthi", mine), cleared: 0 };
}

/** The formations open so far: two, and one more per chapter won. */
export const formationsOf = (p) => FORMATION_ORDER.slice(0, 2 + Math.floor(p.cleared / STAGES_PER_CHAPTER));
export const stagesOf = (p) => campaign(p.kingdom);
/** The player's side of a battle. */
export const teamOf = (p) => ({ formation: p.formation, units: p.lineup.map((u) => ({ ...u, lvl: p.owned[u.gid].lvl })) });

/** Put a lineup in place; throws when it isn't one the player can field. */
export function setLineup(p, formation, units) {
  if (!formationsOf(p).includes(formation)) throw new Error(`chưa mở trận ${FORMATIONS[formation]?.name ?? formation}`);
  for (const u of units) if (!p.owned[u.gid]) throw new Error(`chưa có tướng ${GENERALS[u.gid]?.name ?? u.gid}`);
  const err = teamError({ formation, units });
  if (err) throw new Error(err);
  p.formation = formation;
  p.lineup = units.map(({ gid, slot }) => ({ gid, slot }));
}

function gainXp(rec, xp) {
  const from = rec.lvl;
  rec.xp += xp;
  while (rec.lvl < MAX_LVL && rec.xp >= xpNext(rec.lvl)) { rec.xp -= xpNext(rec.lvl); rec.lvl++ }
  if (rec.lvl >= MAX_LVL) rec.xp = 0;
  return from;
}

/** A won stage: experience for those who fought; the first time, its generals join and the campaign moves on. */
export function applyWin(p, index) {
  const stages = stagesOf(p), stage = stages[index];
  if (!stage || index > p.cleared) throw new Error("ải chưa mở");
  const out = { xp: stage.xp, levelUps: [], recruits: [], formation: null };
  for (const { gid } of p.lineup) {
    const from = gainXp(p.owned[gid], stage.xp);
    if (p.owned[gid].lvl > from) out.levelUps.push({ gid, from, to: p.owned[gid].lvl });
  }
  if (index === p.cleared) {
    const before = formationsOf(p).length;
    // a newcomer arrives no greener than the stage it came from, no stronger than the player's best
    const joinLvl = Math.min(stage.lvl, Math.max(...Object.values(p.owned).map((r) => r.lvl)));
    for (const gid of stage.rewards) if (!p.owned[gid]) { p.owned[gid] = { lvl: joinLvl, xp: 0 }; out.recruits.push(gid) }
    p.cleared++;
    const now = formationsOf(p);
    if (now.length > before) out.formation = now[now.length - 1];
  }
  return out;
}

export function save(storage, p) { storage.setItem(KEY, JSON.stringify(p)) }

/** Of two saves of the same player (this device's and Telegram's), the one that has gone further: more stages
 *  cleared, then more levels gained. A tie keeps the first. Either may be null. */
export function further(a, b) {
  if (!a || !b) return a ?? b;
  const levels = (p) => Object.values(p.owned).reduce((n, r) => n + r.lvl, 0);
  return b.cleared > a.cleared || (b.cleared === a.cleared && levels(b) > levels(a)) ? b : a;
}

/** The saved profile, or null when there is none or it doesn't hold together. */
export function load(storage) {
  try {
    const p = JSON.parse(storage.getItem(KEY));
    if (p?.v !== 1 || !STARTERS[p.kingdom] || !Number.isInteger(p.cleared)) return null;
    for (const gid of Object.keys(p.owned)) if (!GENERALS[gid]) delete p.owned[gid];
    p.lineup = p.lineup.filter((u) => p.owned[u.gid]);
    if (!formationsOf(p).includes(p.formation) || teamError({ formation: p.formation, units: p.lineup })) {
      p.formation = "phongthi"; p.lineup = autoPlace("phongthi", Object.keys(p.owned).slice(0, 5));
    }
    return p;
  } catch { return null }
}
