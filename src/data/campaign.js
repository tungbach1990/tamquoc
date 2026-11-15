// The campaign: 6 chapters of 5 stages. Chapters 4 and 5 are the two kingdoms the player didn't pick.
// campaign(kingdom) -> 30 stages: { id, ch, chapter, name, formation, lvl, foes: [{ gid, slot, lvl }], rewards: [gid], xp }.

import { GENERALS } from "./generals.js";
import { FORMATION_ORDER } from "./formations.js";
import { autoPlace } from "../battle.js";

/** The three generals each kingdom starts with. */
export const STARTERS = { thuc: ["liubei", "guanyu", "zhangfei"], nguy: ["caocao", "xiahoudun", "xuchu"], ngo: ["sunce", "zhouyu", "taishici"] };
/** The rest of a kingdom's ten, in the order "own:0".."own:6" hands them out. */
export const recruitsOf = (kingdom) => Object.values(GENERALS).filter((g) => g.k === kingdom && !STARTERS[kingdom].includes(g.id)).map((g) => g.id);

// [name, foes, rewards]
const CH1 = ["Loạn Khăn Vàng", [
  ["Giặc cỏ Trác Quận", ["zhangliang"], ["own:0"]],
  ["Dĩnh Xuyên", ["zhangbao", "zhangliang"], ["zhangliang"]],
  ["Quảng Tông", ["zhangjiao", "zhangliang"], ["zhangbao", "own:1"]],
  ["Ba anh em họ Trương", ["zhangjiao", "zhangbao", "zhangliang"], ["own:2"]],
  ["Thiên Công Tướng Quân", ["zhangjiao", "zhangbao", "zhangliang"], ["zhangjiao"]],
]];
const CH2 = ["Thảo phạt Đổng Trác", [
  ["Tỵ Thủy Quan", ["huaxiong", "gaoshun"], ["huaxiong", "own:3"]],
  ["Hãm Trận Doanh", ["huaxiong", "gaoshun", "chengong"], ["gaoshun"]],
  ["Hổ Lao Quan", ["lubu", "chengong", "gaoshun"], ["chengong", "own:4"]],
  ["Liên Hoàn Kế", ["dongzhuo", "diaochan", "huaxiong", "gaoshun"], ["diaochan"]],
  ["Lạc Dương", ["dongzhuo", "lubu", "diaochan", "chengong", "huaxiong"], ["dongzhuo", "lubu"]],
]];
const CH3 = ["Quần hùng cát cứ", [
  ["Giới Kiều", ["gongsunzan", "mateng", "jiling"], ["gongsunzan", "own:5"]],
  ["Thọ Xuân", ["yuanshu", "jiling", "liubiao", "mateng"], ["yuanshu", "jiling", "mateng"]],
  ["Kinh Châu", ["liubiao", "huatuo", "menghuo", "gongsunzan"], ["liubiao", "huatuo", "own:6"]],
  ["Bạch Mã", ["yanliang", "wenchou", "yuanshu", "menghuo", "huatuo"], ["yanliang", "wenchou", "menghuo"]],
  ["Quan Độ", ["yuanshao", "yanliang", "wenchou", "zuoci", "jiling"], ["yuanshao", "zuoci"]],
]];
const KINGDOM_STAGES = {
  thuc: ["Chinh phạt Thục", [
    ["Dương Bình Quan", ["weiyan", "jiangwei", "huangzhong", "pangtong", "liubei"]],
    ["Định Quân Sơn", ["machao", "weiyan", "huangzhong", "pangtong", "jiangwei"]],
    ["Trường Bản", ["zhangfei", "machao", "huangzhong", "liubei", "pangtong"]],
    ["Hán Trung", ["guanyu", "zhangfei", "zhaoyun", "liubei", "zhugeliang"]],
    ["Thành Đô", ["guanyu", "zhangfei", "zhaoyun", "machao", "zhugeliang"]],
  ]],
  nguy: ["Chinh phạt Ngụy", [
    ["Uyển Thành", ["caoren", "xuhuang", "xiahouyuan", "guojia", "xuchu"]],
    ["Bộc Dương", ["xiahoudun", "xuhuang", "xiahouyuan", "caoren", "guojia"]],
    ["Tiêu Dao Tân", ["dianwei", "xuchu", "zhangliao", "xiahouyuan", "guojia"]],
    ["Hứa Xương", ["zhangliao", "xiahoudun", "dianwei", "simayi", "caocao"]],
    ["Lạc Dương", ["caocao", "simayi", "zhangliao", "xuchu", "dianwei"]],
  ]],
  ngo: ["Chinh phạt Ngô", [
    ["Nhu Tu", ["huanggai", "zhoutai", "sunshangxiang", "lumeng", "sunquan"]],
    ["Hợp Phì", ["ganning", "zhoutai", "taishici", "lumeng", "huanggai"]],
    ["Di Lăng", ["sunce", "ganning", "taishici", "luxun", "sunshangxiang"]],
    ["Xích Bích", ["sunce", "lumeng", "zhouyu", "luxun", "sunquan"]],
    ["Kiến Nghiệp", ["sunquan", "zhouyu", "luxun", "ganning", "taishici"]],
  ]],
};
const CH6 = ["Thần tướng giáng thế", [
  ["Quần ma loạn vũ", ["lubu", "yanliang", "wenchou", "zuoci", "dongzhuo"], []],
  ["Thái Bình Đạo", ["zhangjiao", "zhangbao", "zhangliang", "zuoci", "huatuo"], []],
  ["Trần Đường Quan", ["nezha", "lubu", "gaoshun", "diaochan", "chengong"], ["nezha"]],
  ["Quán Giang Khẩu", ["yangjian", "menghuo", "mateng", "huatuo", "zuoci"], ["yangjian"]],
  ["Phong Thần", ["nezha", "yangjian", "lubu", "zhangjiao", "huatuo"], []],
]];

export const STAGES_PER_CHAPTER = 5;
/** The foes' level in each stage. The chapter's last stage fields its strongest generals, so it doesn't also jump a level. */
const LEVELS = [[1, 2, 3, 4, 5], [6, 7, 8, 8, 8], [10, 11, 12, 13, 14], [15, 16, 17, 18, 18], [20, 21, 22, 23, 23], [24, 25, 26, 27, 27]];
/** Troops a stage's win trains: enough that the five who fought keep pace with the next stage. */
export const stageXp = (index) => 80 + index * 18;

export function campaign(kingdom) {
  if (!STARTERS[kingdom]) throw new Error(`không có nước ${kingdom}`);
  const own = recruitsOf(kingdom);
  const others = ["nguy", "thuc", "ngo"].filter((k) => k !== kingdom);
  const chapters = [CH1, CH2, CH3, KINGDOM_STAGES[others[0]], KINGDOM_STAGES[others[1]], CH6];
  return chapters.flatMap(([chapter, stages], ch) => stages.map(([name, foes, rewards = []], s) => {
    const index = ch * STAGES_PER_CHAPTER + s, lvl = LEVELS[ch][s];
    const formation = FORMATION_ORDER[index % FORMATION_ORDER.length];
    return {
      id: `${ch + 1}-${s + 1}`, index, ch, chapter, name, formation, lvl,
      foes: autoPlace(formation, foes).map((u) => ({ ...u, lvl })),
      rewards: rewards.map((r) => (r.startsWith("own:") ? own[+r.slice(4)] : r)),
      xp: stageXp(index),
    };
  }));
}
