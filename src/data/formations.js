// The eight formations. A slot is row*3 + col on a side's 3x3 grid; col 0 is the front line.
// bonus keys: atk (normal attacks), tactic, guard (damage taken, less), plot (strategist damage),
// crit, dodge (chances, added), morale (points at the start), hp (troops).

export const FORMATIONS = {
  phongthi: { name: "Phong Thỉ", slots: [1, 3, 4, 5, 7], bonus: { atk: 0.15 }, desc: "+15% đòn thường" },
  ngulan: { name: "Ngư Lân", slots: [0, 3, 4, 5, 6], bonus: { guard: 0.15 }, desc: "−15% sát thương nhận" },
  nhanhanh: { name: "Nhạn Hành", slots: [1, 2, 3, 7, 8], bonus: { tactic: 0.15 }, desc: "+15% chiến pháp" },
  truongxa: { name: "Trường Xà", slots: [0, 1, 4, 7, 8], bonus: { plot: 0.15 }, desc: "+15% mưu kế" },
  yennguyet: { name: "Yển Nguyệt", slots: [0, 2, 5, 6, 8], bonus: { crit: 0.15 }, desc: "+15% bạo kích" },
  batquai: { name: "Bát Quái", slots: [0, 2, 4, 6, 8], bonus: { dodge: 0.15 }, desc: "+15% né" },
  thattinh: { name: "Thất Tinh", slots: [0, 1, 2, 4, 7], bonus: { morale: 25 }, desc: "+25 sĩ khí đầu trận" },
  chuyhinh: { name: "Chùy Hình", slots: [2, 3, 4, 5, 8], bonus: { hp: 0.1 }, desc: "+10% binh lực" },
};

/** The order they unlock in: the first two from the start, one more for each chapter won. */
export const FORMATION_ORDER = ["phongthi", "ngulan", "nhanhanh", "truongxa", "yennguyet", "batquai", "thattinh", "chuyhinh"];
