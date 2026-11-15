// How the campaign goes for a simple player (the five strongest, autoPlace, Phong Thỉ):
//   node tamquoc/tools/balance.mjs [thuc|nguy|ngo]
// One line per stage: tries it took, the levels fielded, win rate over 40 seeds with that army.
import { simulate, autoPlace, power } from "../src/battle.js";
import { newProfile, applyWin, setLineup, teamOf, stagesOf } from "../src/profile.js";

const foesOf = (s) => ({ formation: s.formation, units: s.foes });
for (const k of process.argv[2] ? [process.argv[2]] : ["thuc", "nguy", "ngo"]) {
  const p = newProfile(k), stages = stagesOf(p);
  let seed = 1, replays = 0;
  console.log(`\n== ${k} ==`);
  for (let i = 0; i < stages.length; i++) {
    let tries = 0, rate = null;
    for (; tries < 12; tries++) {
      const five = Object.keys(p.owned).sort((a, b) => power(b, p.owned[b].lvl) - power(a, p.owned[a].lvl)).slice(0, 5);
      setLineup(p, "phongthi", autoPlace("phongthi", five));
      if (rate === null) { let w = 0; for (let s = 1000; s < 1040; s++) w += simulate(teamOf(p), foesOf(stages[i]), s).winner === 0; rate = w / 40 }
      if (simulate(teamOf(p), foesOf(stages[i]), seed++).winner === 0) { applyWin(p, i); break }
      if (i && simulate(teamOf(p), foesOf(stages[i - 1]), seed++).winner === 0) applyWin(p, i - 1);
      replays++;
    }
    console.log(`${stages[i].id.padEnd(4)} lvl ${String(stages[i].lvl).padStart(2)}  tries ${tries}  first-try rate ${rate.toFixed(2)}  army ${p.lineup.map((u) => `${u.gid}:${p.owned[u.gid].lvl}`).join(" ")}`);
    if (p.cleared <= i) { console.log("STUCK"); break }
  }
  console.log(`replays ${replays}, owned ${Object.keys(p.owned).length}`);
}
