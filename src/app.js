// The screens: pick a kingdom, the hall, the campaign, the lineup, the battle, its result, the generals.
// Each screen is a string of HTML put into #ui; buttons carry data-act and one listener routes them.

import { GENERALS, GENERAL_IDS, KINGDOMS, TYPES, SHAPES, FX } from "./data/generals.js";
import { FORMATIONS } from "./data/formations.js";
import { STARTERS } from "./data/campaign.js";
import { simulate, autoPlace, power, maxHp } from "./battle.js";
import { newProfile, load, save, further, applyWin, setLineup, teamOf, formationsOf, stagesOf, xpNext, MAX_LVL, KEY } from "./profile.js";
import { telegramInit, cloudLoad, cloudSave, cloudClear, ask } from "./telegram.js";
import { loadManifest, hasArt, artIds, portraitUrl, sprite, preload, drawSprite, animOf } from "./sprites.js";
import { createBattleView } from "./view.js";
import { VFX } from "./data/vfx.js";

const stage = document.getElementById("stage"), ui = document.getElementById("ui"), cv = document.getElementById("cv"), toastEl = document.getElementById("toast");
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const BLURB = {
  thuc: "Nhân nghĩa. Lưu Bị hồi binh lực cho toàn quân, Quan Vũ và Trương Phi xung trận.",
  nguy: "Gian hùng. Tào Tháo làm địch mất sĩ khí, Hạ Hầu Đôn và Hứa Chử đánh một chọi một.",
  ngo: "Hỏa công. Chu Du thiêu toàn quân địch, Thái Sử Từ bắn vào hậu quân.",
};

let P = null;            // the profile
let view = null;         // the running battle view
let viewer = null;       // the running animation viewer on a general's page
let L = null;            // the lineup being edited: { i, formation, seats: Map(slot -> gid), sel }
let token = 0;           // bumps on every screen change, so late async work can tell it's stale
let speed = 1;
let atHome = false;      // on the hall (or picking a kingdom): there Telegram's Back button leaves for the list of games
const HUB = "../games/"; // the list of games, published beside this one

// ---------------- plumbing ----------------
function fit() { stage.style.fontSize = `${stage.clientWidth / 540 * 16}px` }
addEventListener("resize", fit);
function toast(text) {
  toastEl.textContent = text; toastEl.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => (toastEl.hidden = true), 2200);
}
addEventListener("error", (e) => toast("Lỗi: " + e.message));
addEventListener("unhandledrejection", (e) => toast("Lỗi: " + (e.reason?.message ?? e.reason)));

function show(html, cls = "") {
  token++;
  atHome = false;
  view?.stop(); view = null;
  if (viewer) { cancelAnimationFrame(viewer.raf); viewer = null }
  cv.hidden = cls !== "battle";
  ui.className = cls; ui.innerHTML = html; ui.scrollTop = 0;
}
const persist = () => { save(localStorage, P); cloudSave(JSON.stringify(P)) };
const pt = (id) => {
  const g = GENERALS[id], k = g?.k ?? "none";
  // the art is drawn facing left; a portrait is mirrored so that every general looks right, as on the player's side
  return hasArt(id) ? `<span class="pt k-${k} ${g?.facing === "right" ? "" : "flip"}" style="background-image:url(${portraitUrl(id)})"></span>` : `<span class="pt none k-${k}">${esc(g.name.split(" ").slice(-2).join(" "))}</span>`;
};
const names = (ids) => ids.map((id) => GENERALS[id].name).join(", ");

// ---------------- screens ----------------
function kingdomScreen() {
  show(`<h1>Tam Quốc Dàn Trận</h1><p class="center sub">Chọn nước để bắt đầu. Mỗi nước khởi đầu với ba tướng.</p>` +
    Object.keys(STARTERS).map((k) => `<button class="kingdom k-${k}" data-act="pick-kingdom" data-k="${k}"><span class="seal">${KINGDOMS[k][0]}</span><span><b>${KINGDOMS[k]}</b><br>${esc(names(STARTERS[k]))}<br><span class="sub">${BLURB[k]}</span></span></button>`).join(""));
}

function home() {
  const stages = stagesOf(P), next = stages[P.cleared];
  show(`<h1>Tam Quốc Dàn Trận</h1>
    <p class="center sub">Nước ${KINGDOMS[P.kingdom]} · Ải ${P.cleared}/${stages.length} · ${Object.keys(P.owned).length} tướng</p>
    <button class="big gold" data-act="campaign">⚔ Chiến dịch${next ? ` · ${next.id} ${esc(next.name)}` : " · đã phá đảo"}</button>
    <button class="big" data-act="lineup">Dàn trận</button>
    <button class="big" data-act="generals">Tướng</button>
    <span class="grow"></span>
    <button class="ghost" data-act="reset">Chơi lại từ đầu</button>`);
  atHome = true;
}

function campaignScreen() {
  const stages = stagesOf(P), chapters = [];
  for (const s of stages) (chapters[s.ch] ??= []).push(s);
  show(`<div class="row"><button class="ghost back" data-act="home">‹ Sảnh</button><h2 class="grow">Chiến dịch</h2></div>` +
    chapters.map((list, ch) => `<div class="chapter"><h2>Chương ${ch + 1} · ${esc(list[0].chapter)}</h2>` + list.map((s) => {
      const state = s.index < P.cleared ? "done" : s.index === P.cleared ? "next" : "";
      const reward = s.rewards.filter((r) => !P.owned[r]);
      return `<button class="stage ${state}" data-act="stage" data-i="${s.index}" ${s.index > P.cleared ? "disabled" : ""}><span class="n">${s.id}</span><span class="grow">${esc(s.name)}<br><span class="sub">Cấp ${s.lvl} · ${s.foes.length} tướng${reward.length ? ` · thu phục: ${esc(names(reward))}` : ""}</span></span><span>${state === "done" ? "✔" : state === "next" ? "›" : "🔒"}</span></button>`;
    }).join("") + `</div>`).join(""));
  ui.querySelector(".stage.next")?.scrollIntoView({ block: "center" });
}

function lineupScreen(i = null) {
  L = { i, formation: P.formation, seats: new Map(P.lineup.map((u) => [u.slot, u.gid])), sel: null };
  drawLineup();
}
function drawLineup() {
  const keep = ui.scrollTop;
  const s = L.i == null ? null : stagesOf(P)[L.i], f = FORMATIONS[L.formation], placed = new Set(L.seats.values());
  const bench = Object.keys(P.owned).sort((a, b) => power(b, P.owned[b].lvl) - power(a, P.owned[a].lvl));
  const total = [...placed].reduce((n, gid) => n + power(gid, P.owned[gid].lvl), 0);
  const cell = (slot) => {
    const gid = L.seats.get(slot), open = f.slots.includes(slot);
    return `<div class="cell ${open ? "open" : ""} ${open && L.sel ? "target" : ""}" ${open ? `data-act="seat" data-slot="${slot}"` : ""}>${gid ? `${pt(gid)}<span>${esc(GENERALS[gid].name)}</span>` : open ? "trống" : ""}</div>`;
  };
  show(`<div class="row"><button class="ghost back" data-act="${s ? "campaign" : "home"}">‹ ${s ? "Chiến dịch" : "Sảnh"}</button><h2 class="grow">${s ? `Ải ${s.id} · ${esc(s.name)}` : "Dàn trận"}</h2></div>
    ${s ? `<p class="foes">Địch cấp ${s.lvl}, trận ${FORMATIONS[s.formation].name}: ${esc(names(s.foes.map((u) => u.gid)))}</p>` : ""}
    <div class="row wrap">${formationsOf(P).map((id) => `<button class="chip ${id === L.formation ? "on" : ""}" data-act="formation" data-f="${id}">${FORMATIONS[id].name}</button>`).join("")}</div>
    <p class="sub">${f.name}: ${f.desc}. Chạm một tướng rồi chạm ô sáng; chạm ô có tướng để rút về.</p>
    <div class="grid">${[0, 1, 2].map((r) => [2, 1, 0].map((c) => cell(r * 3 + c)).join("")).join("")}</div>
    <p class="sub center">← hậu quân · tiền tuyến →</p>
    <div class="row"><button data-act="auto">Tự xếp</button><span class="grow sub center">Lực chiến ${total}</span><button class="gold big" data-act="fight">${s ? "⚔ Xuất trận" : "Lưu"}</button></div>
    <div class="bench">${bench.map((gid) => { const g = GENERALS[gid]; return `<div class="tile k-${g.k} ${L.sel === gid ? "sel" : ""} ${placed.has(gid) ? "used" : ""}" data-act="choose" data-id="${gid}">${pt(gid)}<span>${esc(g.name)}</span><small>${TYPES[g.type]} · cấp ${P.owned[gid].lvl}</small></div>` }).join("")}</div>`);
  ui.scrollTop = keep;
}
function seat(slot) {
  const here = L.seats.get(slot);
  if (!L.sel) { if (here) { L.seats.delete(slot); drawLineup() } return }
  const from = [...L.seats].find(([, gid]) => gid === L.sel)?.[0];
  if (from == null && !here && L.seats.size >= 5) return toast("Tối đa 5 tướng ra trận");
  if (from != null) { L.seats.delete(from); if (here) L.seats.set(from, here) }
  L.seats.set(slot, L.sel); L.sel = null;
  drawLineup();
}
function commitLineup() {
  try { setLineup(P, L.formation, [...L.seats].map(([slot, gid]) => ({ gid, slot }))) } catch (e) { toast(e.message[0].toUpperCase() + e.message.slice(1)); return false }
  persist();
  return true;
}

async function battleScreen(i) {
  const s = stagesOf(P)[i], team = teamOf(P);
  const result = simulate(team, { formation: s.formation, units: s.foes }, (Date.now() ^ (i * 7919)) >>> 0);
  show(`<div class="row"><b class="grow">Ải ${s.id} · ${esc(s.name)}</b><button class="chip" data-act="speed">x${speed}</button><button class="chip" data-act="skip">Bỏ qua ⏭</button></div><div id="log"><div class="round">Đang tập hợp quân…</div></div>`, "battle");
  const mine = token;
  await loadArt([...team.units, ...s.foes].map((u) => u.gid));
  if (mine !== token) return;                       // the player left while the art was loading
  const logEl = document.getElementById("log");
  view = createBattleView(cv, result, {
    chapter: s.ch,
    onLog(text, cls) { const d = document.createElement("div"); d.className = cls; d.textContent = text; logEl.append(d); while (logEl.children.length > 7) logEl.firstChild.remove() },
    onDone(winner) { setTimeout(() => { if (mine === token) resultScreen(i, winner, result.rounds) }, 1100) },
  });
  view.setSpeed(speed);
}

/** The sheets a battle needs: its generals, and the spirit beasts of their tactics. */
const loadArt = (gids) => Promise.all([preload(gids), preload(gids.map((gid) => VFX[gid]?.beast).filter(Boolean), "beasts")]);

/** A general's tactic played once against five stand-ins, then back to his page. */
async function demoScreen(id) {
  const g = GENERALS[id], heal = g.tactic.shape === "heal";
  const stand = (pool, slots) => pool.filter((gid) => gid !== id).slice(0, slots.length).map((gid, i) => ({ gid, slot: slots[i], lvl: 30 }));
  const mine = { formation: "phongthi", units: [{ gid: id, slot: 3, lvl: 30, morale: 100 }, ...(heal ? stand(["liubei", "zhangfei", "zhugeliang", "huangzhong", "weiyan"], [4, 1, 7, 5]) : [])] };
  // a column tactic is shown against the middle column, where three stand, not the one man in front
  const foes = { formation: "phongthi", units: stand(["zhangliang", "gaoshun", "zhangbao", "jiling", "zhangjiao", "huaxiong"], g.tactic.shape === "col" ? [4, 1, 7, 5] : [3, 1, 7, 4, 5]) };
  // a preview where the blow lands: the first of a few battles in which nobody dodges it
  let full, cast;
  for (let seed = 1; seed <= 30; seed++) {
    full = simulate(mine, foes, seed, 1); cast = full.events.findIndex((e) => e.t === "act" && e.id === 3);
    if (!full.events[cast].hits.some((h) => h.dodge)) break;
  }
  // only his tactic is shown: the round's opening, his action, the end
  const result = { ...full, winner: 0, events: [...full.events.slice(0, cast + 1), { t: "end", winner: 0, rounds: 1 }] };
  show(`<div class="row"><button class="ghost back" data-act="general" data-id="${id}">‹ ${esc(g.name)}</button><b class="grow center">${esc(g.tactic.name)}</b><button class="chip" data-act="demo" data-id="${id}">↻ Xem lại</button></div><div id="log"><div class="round">Đang tải hình…</div></div>`, "battle");
  const me = token;
  await loadArt([...mine.units, ...foes.units].map((u) => u.gid));
  if (me !== token) return;
  const logEl = document.getElementById("log");
  view = createBattleView(cv, result, {
    chapter: 5, quiet: true,
    onLog(text, cls) { const d = document.createElement("div"); d.className = cls; d.textContent = text; logEl.append(d) },
    onDone() { logEl.append(Object.assign(document.createElement("div"), { className: "round done", textContent: "Hết. Bấm ↻ để xem lại." })) },
  });
}

function resultScreen(i, winner, rounds) {
  const stages = stagesOf(P), s = stages[i];
  if (winner !== 0) {
    return show(`<h1 class="lose">Bại trận</h1><p class="center sub">Ải ${s.id} · ${esc(s.name)} · ${rounds} hiệp</p>
      <p>Thử đổi trận hình, đưa tướng Bộ lên tiền tuyến che cho Cung và Mưu, hoặc đánh lại ải cũ để lên cấp.</p>
      <span class="grow"></span>
      <button class="big gold" data-act="stage" data-i="${i}">Dàn trận lại</button>
      <button class="big" data-act="campaign">Chiến dịch</button>`);
  }
  const out = applyWin(P, i);
  persist();
  const next = stages[i + 1];
  show(`<h1>Thắng trận!</h1><p class="center sub">Ải ${s.id} · ${esc(s.name)} · ${rounds} hiệp · mỗi tướng ra trận +${out.xp} kinh nghiệm</p>
    ${out.levelUps.length ? `<h2>Lên cấp</h2><div class="gain">${out.levelUps.map((l) => `<span>${esc(GENERALS[l.gid].name)} ${l.from} → ${l.to}</span>`).join("")}</div>` : ""}
    ${out.recruits.length ? `<h2>Tướng mới về dưới trướng</h2><div class="row wrap">${out.recruits.map((gid) => `<div class="tile k-${GENERALS[gid].k}" data-act="general" data-id="${gid}">${pt(gid)}<span>${esc(GENERALS[gid].name)}</span><small>${TYPES[GENERALS[gid].type]} · cấp ${P.owned[gid].lvl}</small></div>`).join("")}</div>` : ""}
    ${out.formation ? `<h2>Trận hình mới</h2><p>${FORMATIONS[out.formation].name}: ${FORMATIONS[out.formation].desc}</p>` : ""}
    ${!next ? `<h2>Thiên hạ thái bình</h2><p>Bạn đã qua hết ${stages.length} ải.</p>` : ""}
    <span class="grow"></span>
    ${next ? `<button class="big gold" data-act="stage" data-i="${i + 1}">Ải tiếp · ${next.id} ${esc(next.name)} ›</button>` : ""}
    <button class="big" data-act="stage" data-i="${i}">Đánh lại</button>
    <button class="big" data-act="home">Về sảnh</button>`);
}

const TABS = ["thuc", "nguy", "ngo", "than", "none"];
function generalsScreen(tab = P.kingdom) {
  const extras = artIds().filter((id) => !GENERALS[id]);
  const ids = tab === "extra" ? extras : GENERAL_IDS.filter((id) => GENERALS[id].k === tab);
  show(`<div class="row"><button class="ghost back" data-act="home">‹ Sảnh</button><h2 class="grow">Tướng</h2><span class="sub">${artIds().filter((id) => GENERALS[id]).length}/${GENERAL_IDS.length} có hình</span></div>
    <div class="row wrap">${TABS.map((k) => `<button class="chip ${k === tab ? "on" : ""}" data-act="generals" data-tab="${k}">${KINGDOMS[k]}</button>`).join("")}${extras.length ? `<button class="chip ${tab === "extra" ? "on" : ""}" data-act="generals" data-tab="extra">Xem thử</button>` : ""}</div>
    <div class="bench">${ids.map((id) => {
      const g = GENERALS[id], own = P.owned[id];
      return g ? `<div class="tile k-${g.k} ${own ? "" : "locked"}" data-act="general" data-id="${id}">${pt(id)}<span>${esc(g.name)}</span><small>${TYPES[g.type]} · ${own ? `cấp ${own.lvl}` : "chưa có"}${hasArt(id) ? "" : " · chưa có hình"}</small></div>`
        : `<div class="tile" data-act="general" data-id="${id}"><span class="pt flip" style="background-image:url(${portraitUrl(id)})"></span><span>${esc(id)}</span><small>bản thử</small></div>`;
    }).join("")}</div>`);
}

function generalScreen(id) {
  const g = GENERALS[id], own = P.owned[id], lvl = own?.lvl ?? 1;
  show(`<div class="row"><button class="ghost back" data-act="generals" data-tab="${g ? g.k : "extra"}">‹ Tướng</button><h2 class="grow">${esc(g?.name ?? id)}</h2><span class="sub">${g ? `${KINGDOMS[g.k]} · ${TYPES[g.type]} · ${own ? `cấp ${lvl}${lvl < MAX_LVL ? ` (${own.xp}/${xpNext(lvl)})` : ""}` : "chưa có"}` : "bản thử"}</span></div>
    <canvas class="viewer" id="viewer" width="1080" height="720"></canvas>
    <div class="row wrap" id="anims"><span class="sub">${hasArt(id) ? "Đang tải hình…" : "Tướng này chưa có hình."}</span></div>
    ${g ? `<div class="stats"><div><b>${g.wu}</b>Võ</div><div><b>${g.tri}</b>Trí</div><div><b>${g.thong}</b>Thống</div></div>
    <p>Binh lực <b>${maxHp(g, lvl)}</b> · Lực chiến <b>${power(id, lvl)}</b></p>
    <p><b>${esc(g.tactic.name)}</b>: ${g.tactic.shape === "heal" ? SHAPES.heal : `đánh ${SHAPES[g.tactic.shape]}`}${g.tactic.fx ? `, ${FX[g.tactic.fx]}` : ""}.</p>
    <button class="big gold" data-act="demo" data-id="${id}">▶ Xem chiến pháp</button>` : ""}`);
  if (!hasArt(id)) return;
  const mine = token, s = sprite(id), canvas = document.getElementById("viewer"), ctx = canvas.getContext("2d");
  s.promise.then(() => {
    if (mine !== token || !s.ready) return;
    viewer = { anim: animOf(s, "idle"), faceRight: true, t0: performance.now(), raf: 0 };
    document.getElementById("anims").innerHTML = Object.keys(s.tags).map((n) => `<button class="chip" data-act="anim" data-n="${n}">${n}</button>`).join("") + `<button class="chip" data-act="flip">⇄ lật</button><span class="sub">hình gốc quay ${s.facing === "left" ? "trái" : "phải"}</span>`;
    const tick = (now) => {
      ctx.setTransform(2, 0, 0, 2, 0, 0); ctx.clearRect(0, 0, 540, 360);
      ctx.beginPath(); ctx.ellipse(270, 320, 60, 14, 0, 0, Math.PI * 2); ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.fill();
      drawSprite(ctx, s, viewer.anim, now - viewer.t0, 270, 320, { scale: 230 / s.h, faceRight: viewer.faceRight });
      viewer.raf = requestAnimationFrame(tick);
    };
    viewer.raf = requestAnimationFrame(tick);
    viewer.s = s;
    markAnim();
  });
}
const markAnim = () => { for (const b of ui.querySelectorAll("[data-act=anim]")) b.classList.toggle("on", b.dataset.n === viewer.anim) };

// ---------------- actions ----------------
const ACT = {
  "pick-kingdom": ({ k }) => { P = newProfile(k); persist(); home() },
  home, campaign: campaignScreen,
  reset: async () => { if (await ask("Xóa toàn bộ tiến độ và chọn lại nước?")) { localStorage.removeItem(KEY); cloudClear(); P = null; kingdomScreen() } },
  stage: ({ i }) => lineupScreen(+i),
  lineup: () => lineupScreen(),
  choose: ({ id }) => { L.sel = L.sel === id ? null : id; drawLineup() },
  seat: ({ slot }) => seat(+slot),
  formation: ({ f }) => { L.formation = f; L.seats = new Map(autoPlace(f, [...L.seats.values()]).map((u) => [u.slot, u.gid])); drawLineup() },
  auto: () => {
    const five = Object.keys(P.owned).sort((a, b) => power(b, P.owned[b].lvl) - power(a, P.owned[a].lvl)).slice(0, 5);
    L.seats = new Map(autoPlace(L.formation, five).map((u) => [u.slot, u.gid])); L.sel = null; drawLineup();
  },
  fight: () => { if (commitLineup()) { if (L.i == null) { toast("Đã lưu đội hình"); home() } else battleScreen(L.i) } },
  speed: (_, el) => { speed = speed === 1 ? 2 : speed === 2 ? 4 : 1; el.textContent = `x${speed}`; view?.setSpeed(speed) },
  skip: () => view?.skip(),
  generals: ({ tab }) => generalsScreen(tab),
  general: ({ id }) => generalScreen(id),
  demo: ({ id }) => demoScreen(id),
  anim: ({ n }) => { if (viewer) { viewer.anim = n; viewer.t0 = performance.now(); markAnim() } },
  flip: () => { if (viewer) viewer.faceRight = !viewer.faceRight },
};
stage.addEventListener("click", (e) => {
  const el = e.target.closest("[data-act]");
  if (el && !el.disabled) ACT[el.dataset.act]?.(el.dataset, el);
});

// ---------------- start ----------------
fit();
telegramInit(() => { if (atHome || !P) location.href = HUB; else home() });
// in Telegram the save is also kept on Telegram's side: whichever has gone further is the one played
const [, cloud] = await Promise.all([loadManifest(), cloudLoad()]);
P = further(load(localStorage), cloud && load({ getItem: () => cloud }));
if (P) { save(localStorage, P); home() } else { kingdomScreen(); atHome = true }
