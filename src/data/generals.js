// The 52 generals. k: kingdom (thuc, nguy, ngo, than = gods, none = no kingdom).
// type: B bộ (foot), K kỵ (cavalry), C cung (archer), M mưu (strategist).
// wu võ, tri trí, thong thống. tactic: { name, shape: single|row|col|all|heal, fx?: stun|demoralize|heal }.
// facing ("left"|"right") overrides the direction the sprite loader guesses from the art.

const g = (id, name, k, type, wu, tri, thong, tname, shape, fx) => ({ id, name, k, type, wu, tri, thong, tactic: { name: tname, shape, fx } });

const LIST = [
  // ---- Thục ----
  g("liubei", "Lưu Bị", "thuc", "B", 75, 78, 88, "Nhân Đức", "heal"),
  g("guanyu", "Quan Vũ", "thuc", "K", 97, 75, 90, "Thanh Long Yển Nguyệt", "col"),
  g("zhangfei", "Trương Phi", "thuc", "B", 98, 40, 75, "Tiếng Thét Trường Bản", "row", "stun"),
  g("zhaoyun", "Triệu Vân", "thuc", "K", 96, 76, 88, "Thất Tiến Thất Xuất", "single"),
  g("zhugeliang", "Gia Cát Lượng", "thuc", "M", 30, 100, 92, "Bát Trận Đồ", "all"),
  g("machao", "Mã Siêu", "thuc", "K", 97, 50, 80, "Thiết Kỵ Tây Lương", "row"),
  g("huangzhong", "Hoàng Trung", "thuc", "C", 93, 60, 78, "Bách Bộ Xuyên Dương", "single"),
  g("weiyan", "Ngụy Diên", "thuc", "B", 92, 60, 80, "Tử Ngọ Kỳ Mưu", "col"),
  g("pangtong", "Bàng Thống", "thuc", "M", 35, 97, 80, "Liên Hoàn Kế", "row", "stun"),
  g("jiangwei", "Khương Duy", "thuc", "B", 89, 90, 88, "Kế Thừa Di Chí", "single", "demoralize"),
  // ---- Ngụy ----
  g("caocao", "Tào Tháo", "nguy", "K", 80, 94, 98, "Gian Hùng", "all", "demoralize"),
  g("xiahoudun", "Hạ Hầu Đôn", "nguy", "B", 92, 55, 82, "Độc Nhãn Cuồng Nộ", "single"),
  g("xiahouyuan", "Hạ Hầu Uyên", "nguy", "C", 91, 55, 80, "Thần Tốc Tiễn", "col"),
  g("zhangliao", "Trương Liêu", "nguy", "K", 94, 78, 92, "Uy Chấn Tiêu Dao Tân", "row"),
  g("xuhuang", "Từ Hoảng", "nguy", "B", 90, 70, 85, "Đại Phủ Phá Trận", "col"),
  g("dianwei", "Điển Vi", "nguy", "B", 96, 35, 65, "Song Kích Hộ Chủ", "single", "stun"),
  g("xuchu", "Hứa Chử", "nguy", "B", 97, 35, 68, "Hổ Si", "single"),
  g("simayi", "Tư Mã Ý", "nguy", "M", 60, 98, 96, "Lang Cố Chi Tướng", "all"),
  g("guojia", "Quách Gia", "nguy", "M", 20, 97, 75, "Thập Thắng Thập Bại", "row", "demoralize"),
  g("caoren", "Tào Nhân", "nguy", "B", 86, 65, 90, "Bát Môn Kim Tỏa", "row"),
  // ---- Ngô ----
  g("sunquan", "Tôn Quyền", "ngo", "B", 70, 82, 90, "Chế Hành", "heal"),
  g("sunce", "Tôn Sách", "ngo", "K", 93, 70, 88, "Tiểu Bá Vương", "row"),
  g("zhouyu", "Chu Du", "ngo", "M", 70, 96, 92, "Hỏa Thiêu Xích Bích", "all"),
  g("luxun", "Lục Tốn", "ngo", "M", 65, 95, 90, "Hỏa Thiêu Liên Doanh", "col"),
  g("lumeng", "Lữ Mông", "ngo", "B", 82, 88, 88, "Bạch Y Độ Giang", "single", "stun"),
  g("ganning", "Cam Ninh", "ngo", "B", 94, 65, 78, "Bách Kỵ Kiếp Doanh", "col"),
  g("taishici", "Thái Sử Từ", "ngo", "C", 93, 65, 80, "Thần Xạ", "single"),
  g("huanggai", "Hoàng Cái", "ngo", "B", 83, 65, 80, "Khổ Nhục Kế", "row"),
  g("sunshangxiang", "Tôn Thượng Hương", "ngo", "C", 82, 70, 65, "Cung Yêu Cơ", "row"),
  g("zhoutai", "Chu Thái", "ngo", "B", 91, 45, 75, "Bất Khuất", "single", "heal"),
  // ---- Thần ----
  g("nezha", "Na Tra", "than", "K", 99, 80, 85, "Phong Hỏa Luân", "all"),
  g("yangjian", "Dương Tiễn", "than", "B", 100, 88, 92, "Thiên Nhãn Tam Tiêm Đao", "col", "stun"),
  // ---- Không phe ----
  g("lubu", "Lữ Bố", "none", "K", 100, 30, 85, "Vô Song", "row"),
  g("dongzhuo", "Đổng Trác", "none", "B", 85, 65, 80, "Bạo Ngược", "all", "demoralize"),
  g("diaochan", "Điêu Thuyền", "none", "M", 25, 85, 40, "Bế Nguyệt Ly Gián", "row", "demoralize"),
  g("huaxiong", "Hoa Hùng", "none", "K", 88, 45, 72, "Trảm Tướng", "single"),
  g("yuanshao", "Viên Thiệu", "none", "B", 70, 72, 88, "Tứ Thế Tam Công", "row"),
  g("yanliang", "Nhan Lương", "none", "K", 94, 42, 78, "Dũng Quán Tam Quân", "single"),
  g("wenchou", "Văn Xú", "none", "K", 94, 40, 76, "Hà Bắc Mãnh Tướng", "col"),
  g("yuanshu", "Viên Thuật", "none", "B", 65, 65, 70, "Ngụy Đế", "row", "demoralize"),
  g("jiling", "Kỷ Linh", "none", "B", 84, 50, 75, "Tam Tiêm Đao", "single"),
  g("zhangjiao", "Trương Giác", "none", "M", 30, 88, 85, "Thái Bình Yêu Thuật", "all"),
  g("zhangbao", "Trương Bảo", "none", "M", 60, 80, 72, "Yêu Thuật Phi Sa", "row"),
  g("zhangliang", "Trương Lương", "none", "B", 80, 55, 72, "Nhân Công Tướng Quân", "single"),
  g("gongsunzan", "Công Tôn Toản", "none", "K", 84, 65, 80, "Bạch Mã Nghĩa Tòng", "row"),
  g("liubiao", "Lưu Biểu", "none", "M", 40, 78, 80, "Kinh Châu Mục", "heal"),
  g("mateng", "Mã Đằng", "none", "K", 86, 55, 82, "Tây Lương Thiết Kỵ", "col"),
  g("chengong", "Trần Cung", "none", "M", 50, 90, 78, "Minh Sách", "col", "stun"),
  g("gaoshun", "Cao Thuận", "none", "B", 88, 60, 88, "Hãm Trận Doanh", "col"),
  g("huatuo", "Hoa Đà", "none", "M", 20, 85, 50, "Thanh Nang Thư", "heal"),
  g("zuoci", "Tả Từ", "none", "M", 40, 95, 60, "Độn Giáp Thiên Thư", "all", "demoralize"),
  g("menghuo", "Mạnh Hoạch", "none", "B", 90, 45, 82, "Nam Man Vương", "row"),
];

export const GENERALS = Object.fromEntries(LIST.map((x) => [x.id, x]));
export const GENERAL_IDS = LIST.map((x) => x.id);
export const KINGDOMS = { thuc: "Thục", nguy: "Ngụy", ngo: "Ngô", than: "Thần", none: "Quần hùng" };
export const TYPES = { B: "Bộ", K: "Kỵ", C: "Cung", M: "Mưu" };
export const SHAPES = { single: "một tướng", row: "cả hàng ngang", col: "cả cột dọc", all: "toàn bộ địch", heal: "hồi binh lực toàn quân" };
export const FX = { stun: "choáng 1 lượt", demoralize: "giảm 25 sĩ khí", heal: "hồi binh lực cho tướng yếu nhất" };
