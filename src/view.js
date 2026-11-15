// The battle on screen: replays simulate()'s events on a canvas. Two 3x3 grids face each other, the
// player's on the left. The view owns no rules: every number it shows came from an event.

import { GENERALS } from "./data/generals.js";
import { MAX_ROUNDS } from "./battle.js";
import { sprite, drawSprite, drawPlaceholder, animOf, animLength } from "./sprites.js";
import { VFX } from "./data/vfx.js";
import { drawCutIn, drawEffect, effectMs, HIT } from "./vfx.js";

export const W = 540, H = 600;
const ROW_Y = [262, 392, 522], COL_X = [[226, 150, 74], [314, 390, 466]];
const FIGURE_H = 100;                                   // a general on foot is drawn about this tall
const tallOf = (u) => FIGURE_H * (u.s.mounted ? 1.25 : 1);   // horse and rider stand taller
// a tactic plays in two beats: the cut-in (the general's banner), then the effect (as long as its kind
// asks: show.ms), whose blow lands at HIT; `after` is the breath before the next general moves
const T = { intro: 700, round: 450, hit: 300, plain: 620, cut: 520, after: 230, skip: 450, end: 600 };
const SKY = [["#f1d9a2", "#b98a4c"], ["#e8b98f", "#8f4a3a"], ["#cfd8c0", "#6e8a5e"], ["#c5d6e6", "#5c7896"], ["#e2c9d6", "#8a5c78"], ["#d7c8f0", "#4c3a78"]];

export const slotPos = (side, slot) => ({ x: COL_X[side][slot % 3], y: ROW_Y[(slot / 3) | 0] });

/** Replay a battle. opts: { chapter, quiet (no win/lose title), onLog(text), onDone(winner) }. Returns { setSpeed, skip, stop }. */
export function createBattleView(canvas, result, opts = {}) {
  const ctx = canvas.getContext("2d");
  const units = new Map(result.units.map((u) => {
    const g = GENERALS[u.gid], home = slotPos(u.side, u.slot);
    return [u.id, { ...u, g, home, dx: 0, anim: "walk", animT: 0, rate: 1, loop: true, dead: false, deadT: 0, hitT: 0, stun: false, s: sprite(u.gid) }];
  }));
  const name = (id) => units.get(id).g.name;
  const log = (text, cls = "") => opts.onLog?.(text, cls);
  let speed = 1, phase = "intro", clock = 0, evI = -1, evT = 0, applied = false, round = 0, raf = 0, last = 0, finished = false;
  let floaters = [], show = null, shake = 0;   // show: the tactic on stage, { env, cast }

  const play = (u, want, loop, fit) => {
    if (!u.s.ready) return;
    const a = animOf(u.s, want);
    if (!a) return;
    u.anim = a; u.animT = 0; u.loop = loop;
    u.rate = fit ? Math.max(1, animLength(u.s, a) / fit) : 1;     // a long animation is hurried to fit its beat
  };
  const float = (u, text, color, big = false) => floaters.push({ x: u.home.x + (floaters.length % 3 - 1) * 8, y: u.home.y - tallOf(u) - 6, text, color, big, t: 0 });

  function apply(ev, quiet) {
    if (ev.t === "round") { round = ev.n; if (!quiet) log(`— Hiệp ${ev.n} —`, "round") }
    else if (ev.t === "skip") { const u = units.get(ev.id); u.stun = false; if (!quiet) { float(u, "Choáng", "#c9b6ff"); log(`${u.g.name} bị choáng, mất lượt`) } }
    else if (ev.t === "act") {
      const src = units.get(ev.id);
      src.morale = ev.morale;
      for (const h of ev.hits) {
        const u = units.get(h.id);
        if (h.dodge) { if (!quiet) float(u, "Né", "#d8d8d8"); continue }
        u.hp = h.hp; u.hitT = 220;
        if (h.morale != null) u.morale = h.morale;
        if (h.stun) u.stun = true;
        if (h.dead) { u.dead = true; u.deadT = 0; u.stun = false; if (!quiet) play(u, "die", false) }
        if (!quiet) float(u, `-${h.dmg}`, h.crit ? "#ffd23c" : "#ff6a5a", h.crit);
      }
      for (const h of ev.heals) { const u = units.get(h.id); u.hp = h.hp; if (!quiet && h.amount) float(u, `+${h.amount}`, "#7be08a") }
      if (!quiet) {
        if (ev.tactic) shake = 420;
        const hurt = ev.hits.filter((h) => !h.dodge), total = hurt.reduce((n, h) => n + h.dmg, 0);
        const what = ev.tactic ? `tung ${ev.tactic}` : "đánh";
        const whom = ev.hits.length === 1 ? ` ${name(ev.hits[0].id)}` : ev.hits.length ? ` ${ev.hits.length} tướng` : "";
        const tail = ev.hits.length ? (hurt.length ? `: −${total}${hurt.some((h) => h.crit) ? " (bạo kích)" : ""}` : ": hụt") : "";
        const healed = ev.heals.reduce((n, h) => n + h.amount, 0);
        log(`${src.g.name} ${what}${whom}${tail}${healed ? `, hồi ${healed}` : ""}`, src.side ? "foe" : "ally");
        for (const h of ev.hits) if (h.dead) log(`${name(h.id)} bại trận`, "dead");
      }
    }
  }

  /** What a tactic's effect is told: who casts it, which way, on whom. */
  function stage(ev) {
    const u = units.get(ev.id), heal = ev.shape === "heal", cfg = VFX[u.gid] ?? { fx: "slash", c: "#f0c040", c2: "#ffffff", n: 1 };
    const spot = (id) => { const t = units.get(id); return { x: t.home.x, y: t.home.y, tall: tallOf(t) } };
    return {
      W, H, cfg, who: u.g.name, tactic: ev.tactic, dir: u.side ? -1 : 1, heal, now: clock,
      caster: { ...spot(ev.id), s: u.s }, targets: (heal ? ev.heals : ev.hits).map((h) => spot(h.id)),
      beast: cfg.beast ? sprite(cfg.beast, "beasts") : null,
    };
  }
  function enter(ev) {
    evT = 0; applied = false; show = null;
    if (ev.t !== "act") return;
    if (ev.tactic) { const env = stage(ev); show = { env, cast: false, ms: effectMs(env.cfg) } }
    else play(units.get(ev.id), "attack", false, T.plain - 60);
  }
  const durOf = (ev) => (ev.t === "act" ? (show ? T.cut + show.ms + T.after : T.plain) : T[ev.t]);
  const hitAt = (ev) => (ev.t === "act" ? (show ? T.cut + show.ms * HIT : T.hit) : 0);

  function finish() {
    if (finished) return;
    finished = true; phase = "done";
    for (const u of units.values()) if (!u.dead) play(u, "idle", true);
    opts.onDone?.(result.winner);
  }

  function update(dt) {
    clock += dt;
    for (const u of units.values()) {
      u.animT += dt * u.rate;
      if (u.hitT > 0) u.hitT -= dt;
      if (u.dead) u.deadT += dt;
      // a finished one-shot falls back to standing
      if (!u.loop && !u.dead && u.s.ready && u.animT >= animLength(u.s, u.anim)) play(u, "idle", true);
    }
    floaters = floaters.filter((f) => (f.t += dt) < 900);
    if (shake > 0) shake -= dt;
    if (phase === "intro") {
      const k = Math.min(1, clock / T.intro), ease = 1 - (1 - k) * (1 - k);
      for (const u of units.values()) u.dx = (u.side ? 1 : -1) * 230 * (1 - ease);
      if (k >= 1) { for (const u of units.values()) play(u, "idle", true); phase = "play"; evI = 0; enter(result.events[0]) }
    } else if (phase === "play") {
      const ev = result.events[evI];
      evT += dt;
      if (show) {
        show.env.now = clock;
        // the general goes into his skill as the banner clears
        if (!show.cast && evT >= T.cut - 160) { show.cast = true; play(units.get(ev.id), "skill01", false, show.ms - 150) }
      } else if (ev.t === "act") {
        // foot and horse step up to strike; archers and strategists stay put
        const u = units.get(ev.id), melee = (u.g.type === "B" || u.g.type === "K") && ev.hits.length;
        const k = Math.min(1, evT / hitAt(ev)), back = Math.max(0, (evT - hitAt(ev)) / (durOf(ev) - hitAt(ev)));
        u.dx = melee ? (u.side ? -1 : 1) * 40 * (evT < hitAt(ev) ? k * k : 1 - back) : 0;
      }
      if (!applied && evT >= hitAt(ev)) { applied = true; apply(ev, false) }
      if (evT >= durOf(ev)) {
        if (ev.t === "act") units.get(ev.id).dx = 0;
        if (ev.t === "end") return finish();
        enter(result.events[++evI]);
      }
    }
  }

  // ---------------- drawing ----------------
  function bar(x, y, w, h, part, color, back = "rgba(20,12,8,.75)") {
    ctx.fillStyle = back; ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = color; ctx.fillRect(x, y, Math.max(0, w * Math.min(1, part)), h);
  }
  function text(str, x, y, size, color, align = "center", weight = "bold") {
    ctx.font = `${weight} ${size}px system-ui, "Segoe UI", sans-serif`;
    ctx.textAlign = align; ctx.textBaseline = "middle";
    ctx.lineWidth = Math.max(2, size / 5); ctx.strokeStyle = "rgba(20,10,6,.85)"; ctx.lineJoin = "round";
    ctx.strokeText(str, x, y); ctx.fillStyle = color; ctx.fillText(str, x, y);
  }

  function draw() {
    const [sky, ground] = SKY[(opts.chapter ?? 0) % SKY.length];
    ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, sky); g.addColorStop(0.3, sky); g.addColorStop(0.31, ground); g.addColorStop(1, "#2a1c14");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // far hills
    ctx.fillStyle = "rgba(40,24,16,.28)";
    ctx.beginPath(); ctx.moveTo(0, 186);
    for (let x = 0; x <= W; x += 30) ctx.lineTo(x, 186 - 26 - 18 * Math.sin(x / 61) - 10 * Math.sin(x / 23 + 1));
    ctx.lineTo(W, 186); ctx.fill();
    if (shake > 0) ctx.translate(Math.sin(clock / 14) * 5 * (shake / 260), Math.cos(clock / 11) * 3 * (shake / 260));
    // the grids
    const taken = new Set([...units.values()].map((u) => u.id));
    for (const side of [0, 1]) for (let slot = 0; slot < 9; slot++) {
      const p = slotPos(side, slot);
      ctx.beginPath(); ctx.ellipse(p.x, p.y, 34, 13, 0, 0, Math.PI * 2);
      ctx.fillStyle = taken.has(side * 9 + slot) ? (side ? "rgba(190,60,50,.30)" : "rgba(60,120,200,.30)") : "rgba(255,240,200,.08)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,240,200,.18)"; ctx.lineWidth = 1; ctx.stroke();
    }
    // a tactic on stage: the field darkens under it
    const fxK = show ? (evT - T.cut) / show.ms : -1;
    if (show) {
      const dim = Math.min(1, evT / 160) * Math.max(0, Math.min(1, (T.cut + show.ms + T.after - evT) / T.after));
      ctx.fillStyle = `rgba(6,4,14,${(0.5 * dim).toFixed(3)})`; ctx.fillRect(-20, -20, W + 40, H + 40);
      if (fxK >= 0) drawEffect(ctx, "back", fxK, show.env);
    }
    // the generals, back rows first
    const order = [...units.values()].sort((a, b) => a.home.y - b.home.y || a.id - b.id);
    for (const u of order) {
      const fade = u.dead ? Math.max(0, 1 - Math.max(0, u.deadT - 500) / 700) : 1;
      if (fade <= 0) continue;
      const jitter = u.hitT > 0 ? Math.sin(u.hitT / 12) * 4 : 0, x = u.home.x + u.dx + jitter, y = u.home.y;
      ctx.beginPath(); ctx.ellipse(x, y, 24, 7, 0, 0, Math.PI * 2); ctx.fillStyle = `rgba(0,0,0,${0.28 * fade})`; ctx.fill();
      if (u.s.ready) {
        const noFall = u.dead && !animOf(u.s, "die");
        drawSprite(ctx, u.s, u.anim, u.animT, x, y, { scale: tallOf(u) / u.s.h, faceRight: u.side === 0, loop: u.loop, alpha: noFall ? fade * 0.6 : fade });
      } else drawPlaceholder(ctx, u.g, x, y, { alpha: fade });
      if (u.hitT > 0) { ctx.beginPath(); ctx.arc(x, y - tallOf(u) * 0.55, 10 + (220 - u.hitT) / 9, 0, Math.PI * 2); ctx.strokeStyle = `rgba(255,255,255,${u.hitT / 220})`; ctx.lineWidth = 3; ctx.stroke() }
    }
    if (show && fxK >= 0) drawEffect(ctx, "front", fxK, show.env);
    // bars and names over them all
    for (const u of order) {
      if (u.dead) continue;
      const x = u.home.x + u.dx, top = u.home.y - tallOf(u) - 16;
      bar(x - 26, top, 52, 5, u.hp / u.max, u.side ? "#e25a4a" : "#58c26a");
      bar(x - 26, top + 7, 52, 3, u.morale / 100, u.morale >= 100 ? "#fff3a0" : "#e0a52c");
      text(u.g.name, x, u.home.y + 11, 10.5, "#fff3d6", "center", "600");
      if (u.stun) text("choáng", x, top - 9, 10, "#c9b6ff");
    }
    for (const f of floaters) {
      ctx.globalAlpha = Math.min(1, (900 - f.t) / 300);
      text(f.text, f.x, f.y - f.t / 18, f.big ? 21 : 15, f.color);
      ctx.globalAlpha = 1;
    }
    ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
    // the header: both armies' troops, the round
    for (const side of [0, 1]) {
      const all = [...units.values()].filter((u) => u.side === side), hp = all.reduce((n, u) => n + u.hp, 0), max = all.reduce((n, u) => n + u.max, 0);
      const x = side ? W / 2 + 34 : 14, w = W / 2 - 48;
      bar(x, 16, w, 12, 1, "rgba(0,0,0,.35)");
      const part = hp / max;
      ctx.fillStyle = side ? "#d6493b" : "#3f8fd8";
      ctx.fillRect(side ? x : x + w * (1 - part), 16, w * part, 12);
      text(`${side ? "Địch" : "Ta"}  ${hp}`, side ? x + w : x, 40, 12, "#fff3d6", side ? "right" : "left");
    }
    text(round ? `${round}/${MAX_ROUNDS}` : "", W / 2, 22, 13, "#ffe9a8");
    if (show && evT < T.cut + 120) drawCutIn(ctx, evT / (T.cut + 120), show.env);
    if (phase === "done" && !opts.quiet) {
      ctx.fillStyle = "rgba(10,6,4,.45)"; ctx.fillRect(0, 0, W, H);
      text(result.winner === 0 ? "THẮNG" : "BẠI", W / 2, H / 2 - 20, 64, result.winner === 0 ? "#ffd86a" : "#c9c9c9");
    }
  }

  function frame(now) {
    const dt = Math.min(50, now - (last || now)) * speed;
    last = now;
    update(dt); draw();
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  return {
    setSpeed(n) { speed = n },
    /** Jump to the end: every event still to come lands at once. */
    skip() {
      if (finished) return;
      for (const u of units.values()) u.dx = 0;
      if (phase === "intro") evI = 0;
      else if (applied) evI++;
      for (; evI < result.events.length; evI++) apply(result.events[evI], true);
      for (const u of units.values()) if (u.dead) u.deadT = 5000;
      floaters = []; show = null; shake = 0;
      finish();
    },
    stop() { cancelAnimationFrame(raf) },
  };
}
