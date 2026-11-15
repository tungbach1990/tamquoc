// What each general's tactic looks like. `fx` names one of the effect kinds in src/vfx.js; `c` is the main
// colour, `c2` its bright accent. Kind-specific knobs:
//   beast:   beast (an id in BEASTS), move: dash (a beast that springs along the ground) | dive (a bird that stoops)
//   slash:   n (how many cuts), heavy (a cleave from above that cracks the ground)
//   arrows:  n (how many), big (one great arrow instead of a volley)
//   fire:    big (the whole field burns)
//   thunder: sand (a sandstorm blows through first)
//   array:   seal (a jade seal drops instead of light pillars)
//   dark:    giant (the caster's own shape looms behind him)
//   roar:    shout (the word thrown out with the sound waves)
// dragon, storm, grace and wheels take no knobs: each is one general's own (Guan Yu's Azure Dragon, Zhuge
// Liang's wind and rain over the eight trigrams, Liu Bei's benevolence, Nezha's Wind Fire Wheels).

/** The spirit beasts that have art (assets/beasts/<id>/): only generals whose story has the beast in it.
 *  facing: "right" when the sheet is drawn facing right. */
export const BEASTS = {
  baihu: { name: "Bạch Hổ" },
  wenhu: { name: "Mãnh Hổ" },
  canglang: { name: "Thương Lang" },
  fengchu: { name: "Phượng Sồ" },
  xiaotian: { name: "Hao Thiên Khuyển" },
  zhanxiang: { name: "Chiến Tượng" },
};

const beast = (id, move, c, c2) => ({ fx: "beast", beast: id, move, c, c2 });
const slash = (c, c2, n = 2, heavy = false) => ({ fx: "slash", c, c2, n, heavy });
const charge = (c, c2) => ({ fx: "charge", c, c2 });

export const VFX = {
  // ---- Thục ----
  liubei: { fx: "grace", c: "#f2c94c", c2: "#fff6c8" },
  guanyu: { fx: "dragon", c: "#1fae6a", c2: "#c8ffe0" },
  zhangfei: { fx: "roar", c: "#e0453a", c2: "#ffd9c8", shout: "HÁÁÁ!!!" },
  zhaoyun: beast("baihu", "dash", "#8fd3ff", "#ffffff"),
  zhugeliang: { fx: "storm", c: "#5fa8ff", c2: "#e8f6ff" },
  machao: charge("#d8e2ee", "#ffffff"),
  huangzhong: { fx: "arrows", c: "#f0b93a", c2: "#fff3c0", n: 1, big: true },
  weiyan: slash("#c0392b", "#ffb199", 2),
  pangtong: beast("fengchu", "dive", "#8e6bff", "#b8f4ff"),
  jiangwei: slash("#3fbf7f", "#d6ffe6", 3),
  // ---- Ngụy ----
  caocao: { fx: "dark", c: "#7a4fd0", c2: "#e0c8ff", giant: true },
  xiahoudun: slash("#3b6fc4", "#cfe2ff", 1),
  xiahouyuan: { fx: "arrows", c: "#4f8fe8", c2: "#e0f0ff", n: 14 },
  zhangliao: charge("#4f8fe8", "#e0f0ff"),
  xuhuang: slash("#5d8fd8", "#ffffff", 1, true),
  dianwei: slash("#b0703a", "#ffd9a8", 2, true),
  xuchu: beast("wenhu", "dash", "#f08a24", "#fff0b0"),
  simayi: beast("canglang", "dash", "#7d6ad8", "#d8d0ff"),
  guojia: { fx: "array", c: "#6fb7ff", c2: "#ffffff" },
  caoren: { fx: "array", c: "#d8a830", c2: "#fff3c0" },
  // ---- Ngô ----
  sunquan: { fx: "heal", c: "#2f9e8f", c2: "#c8fff0" },
  sunce: slash("#e8452c", "#ffe0a0", 3),
  zhouyu: { fx: "fire", c: "#ff5a1f", c2: "#ffe28a", big: true },
  luxun: { fx: "fire", c: "#ff6a1a", c2: "#ffe680" },
  lumeng: slash("#f2f2f2", "#ffffff", 1),
  ganning: charge("#2a8fd8", "#bff0ff"),
  taishici: { fx: "arrows", c: "#e8452c", c2: "#ffe0a0", n: 1, big: true },
  huanggai: { fx: "fire", c: "#e8351a", c2: "#ffb040" },
  sunshangxiang: { fx: "arrows", c: "#ff5a7a", c2: "#ffe0e8", n: 10 },
  zhoutai: slash("#b03030", "#ffd0c0", 2),
  // ---- Thần ----
  nezha: { fx: "wheels", c: "#ff4a1a", c2: "#ffe070" },
  yangjian: beast("xiaotian", "dash", "#c8d8ff", "#ffffff"),
  // ---- Không phe ----
  lubu: charge("#e0241a", "#ffb060"),
  dongzhuo: { fx: "dark", c: "#5a2a7a", c2: "#c060ff" },
  diaochan: { fx: "charm", c: "#ff8fc0", c2: "#fff0f8" },
  huaxiong: slash("#8a5a3a", "#ffd0a0", 1, true),
  yuanshao: { fx: "arrows", c: "#f0c040", c2: "#fff6d0", n: 18 },
  yanliang: slash("#3f9b57", "#e0ffd8", 1, true),
  wenchou: slash("#6a5040", "#ffd8b0", 2),
  yuanshu: { fx: "array", c: "#f0c040", c2: "#fff6d0", seal: true },
  jiling: slash("#c8a030", "#fff0c0", 1),
  zhangjiao: { fx: "thunder", c: "#f0d040", c2: "#ffffff" },
  zhangbao: { fx: "thunder", c: "#d8b040", c2: "#fff0c0", sand: true },
  zhangliang: slash("#c8a030", "#fff0c0", 1),
  gongsunzan: charge("#e8eef8", "#ffffff"),
  liubiao: { fx: "heal", c: "#5fd08a", c2: "#f0ffd8" },
  mateng: charge("#c8a060", "#fff0d0"),
  chengong: { fx: "array", c: "#8f9fd8", c2: "#ffffff" },
  gaoshun: slash("#8a2a2a", "#ffc0b0", 2),
  huatuo: { fx: "heal", c: "#6fd89a", c2: "#f0ffe0" },
  zuoci: { fx: "array", c: "#b8c8ff", c2: "#ffffff" },
  menghuo: beast("zhanxiang", "dash", "#a8743a", "#ffe0a0"),
};

export const FX_KINDS = ["beast", "dragon", "storm", "grace", "wheels", "roar", "slash", "charge", "arrows", "fire", "thunder", "array", "heal", "charm", "dark"];
/** The kinds that play on the caster's own line: only a healing tactic may use them, and must. */
export const HEALING_KINDS = ["heal", "grace"];
