# Bảng gen tướng (MCP `tunnel`)

Cách làm mỗi tướng: `create_sprite(name=<id>, description, keywords)` → `wait_sprite` tới khi `running=false` →
animation nào `unresolved` thì `fix` với ghi chú của server (tối đa 2 lần) → `export_sprite(id, ["png"])` →
`./tamquoc/tools/pull.ps1 -Id <id>` → `node tamquoc/tools/spritecheck.mjs <id>` → sửa cột Trạng thái ở đây.

Mọi mô tả kết thúc bằng: `He/She holds exactly ONE <vũ khí>. No second weapon, nothing on the back.`
Tướng Kỵ (K) cưỡi ngựa (bạn chọn ngày 15/11): từ khóa `mounted cavalry horse rider lancer`, mô tả thêm ngựa và câu
"He stays seated on the horse in every frame...". Lần vẽ đầu luôn mất ngựa ở `walk`/`attack`/`die`; phải `fix` cả ba với ghi chú
"The horse is completely missing ... must stay SEATED on the <ngựa> exactly like design.png ...". Triệu Vân dùng bản `zhaoyun-horse` đã duyệt.
Na Tra là K nhưng đứng trên Phong Hỏa Luân (rig đi bộ).

Trạng thái: ✔ đã có trong `assets/generals/` · ⏳ đang gen · ☐ chưa gen.

## Thục
| id | Tên | Loại | Từ khóa | Mô tả (tóm tắt) | Trạng thái |
|---|---|---|---|---|---|
| zhangfei | Trương Phi | B | humanoid spear warrior | (có từ trước) | ✔ |
| zhaoyun | Triệu Vân | K | mounted cavalry horse rider spear lancer | (có từ trước: bản `zhaoyun-horse`, ngựa trắng) | ✔ |
| liubei | Lưu Bị | B | humanoid sword warrior lord | green-gold robe over bronze armor, long earlobes, ONE jian sword | ✔ |
| zhugeliang | Gia Cát Lượng | M | humanoid mage caster strategist fan | white robe, scholar hat, ONE crane-feather fan | ✔ |
| huangzhong | Hoàng Trung | C | humanoid bow archer ranger | old, white beard, golden armor, ONE war bow | ✔ |
| weiyan | Ngụy Diên | B | humanoid polearm glaive warrior general | dark red face, crimson-black armor, ONE dadao | ✔ |
| pangtong | Bàng Thống | M | humanoid staff mage caster strategist | straw hat, teal-brown robe, wine gourd, ONE phoenix staff | ✔ |
| jiangwei | Khương Duy | B | humanoid spear warrior general | young, ponytail, silver-green armor, ONE spear with green tassel | ✔ |
| guanyu | Quan Vũ | K | humanoid polearm glaive warrior general | deep red face, very long black beard, green headscarf and robe over dark green armor with gold trim, ONE Green Dragon Crescent Blade (guandao) | ✔ |
| machao | Mã Siêu | K | humanoid spear warrior knight | young proud, silver lion-head helmet with tall white plume, white-silver armor, gold lion belt, white cape, ONE long silver spear | ✔ |
## Ngụy
| id | Tên | Loại | Từ khóa | Mô tả (tóm tắt) | Trạng thái |
|---|---|---|---|---|---|
| caocao | Tào Tháo | K | humanoid sword warrior lord | shrewd warlord in his forties, narrow eyes, thin moustache and pointed goatee, gold crown with red tassels, dark purple-black robe over black armor with gold trim, crimson cape, ONE ornate jian sword | ✔ |
| xiahoudun | Hạ Hầu Đôn | B | humanoid saber sword warrior general | black eyepatch over the left eye, short rough beard, dark blue lamellar armor with bronze trim, blue cape, ONE heavy broad sabre (podao) | ✔ |
| xiahouyuan | Hạ Hầu Uyên | C | humanoid bow archer ranger | lean swift general, short black beard, blue headband with a feather, dark blue leather and lamellar light armor, ONE long war bow, quiver at the hip | ✔ |
| zhangliao | Trương Liêu | K | humanoid polearm halberd warrior general | stern disciplined, neat black beard, dark iron helmet with blue plume, dark blue and steel armor, blue cape, ONE crescent halberd (ji) | ✔ |
| xuhuang | Từ Hoảng | B | humanoid axe warrior general | broad-shouldered, white cloth head wrap, thick black beard, steel-blue armor, ONE large long-handled battle axe | ✔ |
| dianwei | Điển Vi | B | humanoid axe halberd berserker warrior | huge muscular bodyguard, bald head, rough stubble, bare scarred arms, tiger skin over dark iron chest armor, ONE massive short iron halberd | ✔ |
| xuchu | Hứa Chử | B | humanoid hammer mace heavy warrior | enormous fat-strong warrior, round face, topknot, bare chest and belly, tiger-skin loincloth, leather straps, iron bracers, ONE giant iron hammer on a long handle | ✔ |
| simayi | Tư Mã Ý | M | humanoid mage caster strategist fan | cunning elder strategist, cold narrow eyes, long thin grey-black beard, tall black official hat, dark purple-black robes with silver wolf embroidery, ONE black feather fan | ✔ |
| guojia | Quách Gia | M | humanoid mage caster scholar | frail pale young genius, gentle sickly face, loose long black hair with a jade hairpin, light blue and white scholar robe, ONE open bamboo-slip scroll | ✔ |
| caoren | Tào Nhân | B | humanoid shield sword knight tank | sturdy defender, square face, short beard, round helmet, heavy steel armor with dark blue trim, a big iron tower shield and ONE short broadsword | ✔ |
## Ngô
| id | Tên | Loại | Từ khóa | Mô tả (tóm tắt) | Trạng thái |
|---|---|---|---|---|---|
| sunquan | Tôn Quyền | B | humanoid sword warrior lord | young king, purple-tinted beard, blue-green eyes, gold crown, red and gold royal robe over gilded armor, ONE jian sword | ✔ |
| sunce | Tôn Sách | K | humanoid spear warrior general | brash handsome young conqueror, grin, short black hair, red headband, red and gold light armor, tiger pelt on one shoulder, ONE long spear with red tassel | ✔ |
| zhouyu | Chu Du | M | humanoid staff mage fire caster | strikingly handsome young commander, long black hair, elegant red and white robe over light silver chest armor, red cape, ONE torch-staff with a flame at the tip | ✔ |
| luxun | Lục Tốn | M | humanoid sword mage scholar | youthful scholar-general, gentle face, scholar cap, white and crimson robe with light armor, ONE slender jian sword with a flame motif | ✔ |
| lumeng | Lữ Mông | B | humanoid saber sword warrior general | mature general, short beard, red headband, plain white robe over dark red armor, ONE broad sabre | ✔ |
| ganning | Cam Ninh | B | humanoid saber sword pirate warrior | wild pirate general, tanned, bare-chested and muscular with tattoos, feathered collar, bronze bells at the belt, red bandana, loose dark trousers, ONE big curved sabre | ✔ |
| taishici | Thái Sử Từ | C | humanoid bow archer ranger | tall athletic general, short beard, red and brown leather-lamellar armor, red headband, ONE long bow, quiver on the hip | ✔ |
| huanggai | Hoàng Cái | B | humanoid mace club warrior veteran | grizzled old veteran, grey beard, bare muscular arms, dark red armor, ONE segmented iron whip-mace (bian) | ✔ |
| sunshangxiang | Tôn Thượng Hương | C | humanoid female bow archer | young warrior princess, confident pretty face, hair in two buns with red ribbons, red and gold light armor over a short red dress, boots, ONE bow, quiver | ✔ |
| zhoutai | Chu Thái | B | humanoid sword warrior bodyguard | silent bodyguard covered in scars, short dark hair, shadowed eyes, dark grey and red armor, ONE long curved single-edged blade | ✔ |
## Thần
| id | Tên | Loại | Từ khóa | Mô tả (tóm tắt) | Trạng thái |
|---|---|---|---|---|---|
| nezha | Na Tra | K | humanoid spear warrior child deity | boy deity, two hair buns with red ribbons, red silk sash floating around the shoulders, golden ring across the body, red and gold lotus armor, standing on two flaming Wind Fire Wheels, ONE fire-tipped spear | ✔ |
| yangjian | Dương Tiễn | B | humanoid polearm trident warrior deity | handsome god-warrior, third vertical eye on the forehead, long black hair, golden crown, silver and gold celestial armor, blue cape, ONE three-pointed double-edged glaive | ✔ |
## Không phe
| id | Tên | Loại | Từ khóa | Mô tả (tóm tắt) | Trạng thái |
|---|---|---|---|---|---|
| lubu | Lữ Bố | K | humanoid polearm halberd warrior general | mightiest warrior, arrogant fierce face, golden headpiece with two very long red pheasant tail feathers, black and crimson heavy armor, gold beast-face belt, red cape, ONE crescent-bladed halberd (Fangtian Huaji) | ✔ |
| dongzhuo | Đổng Trác | B | humanoid saber heavy fat warlord | obese cruel tyrant, fat face, greasy black beard, lavish gold and dark red robes over an enormous belly, fur collar, jeweled crown, ONE jagged heavy sabre | ✔ |
| diaochan | Điêu Thuyền | M | humanoid female dancer mage caster | graceful beautiful dancer, elaborate hair with flowers and gold pins, flowing pink and lavender silk dress with long ribbon sleeves, ONE round silk fan | ✔ |
| huaxiong | Hoa Hùng | K | humanoid saber sword heavy warrior | big brutish general, bushy black beard, horned iron helmet, heavy dark iron armor with fur collar, ONE large broad sabre (dadao) | ✔ |
| yuanshao | Viên Thiệu | B | humanoid sword warrior lord | haughty noble warlord, proud face, neat beard, plumed gold helmet, ornate golden armor, yellow cape, ONE jeweled sword | ✔ |
| yanliang | Nhan Lương | K | humanoid polearm glaive warrior general | burly northern general, thick beard, bronze helmet with red plume, dark green armor with bronze studs, ONE long-handled broad sabre | ✔ |
| wenchou | Văn Xú | K | humanoid spear warrior general | ugly fierce northern general, wild spiky dark hair and beard, scarred face, dark brown-black armor with fur, ONE long spear with a hooked blade | ✔ |
| yuanshu | Viên Thuật | B | humanoid sword warrior emperor | vain pompous self-proclaimed emperor, plump smug face, thin moustache, flat-topped imperial crown with bead curtains, imperial yellow dragon robe, ONE ornate golden sword | ✔ |
| jiling | Kỷ Linh | B | humanoid polearm trident warrior general | stout loyal general, round helmet, mustard-yellow and brown armor, ONE three-pointed double-edged long blade | ✔ |
| zhangjiao | Trương Giác | M | humanoid staff mage sorcerer | gaunt wild-eyed old sorcerer, long unkempt grey hair and beard, yellow turban headband, tattered yellow Taoist robe with paper talismans, ONE crooked wooden staff with hanging talismans | ✔ |
| zhangbao | Trương Bảo | M | humanoid sword mage sorcerer | sorcerer-general, long loose black hair, yellow headband, yellow and black Taoist robe over light armor, ONE straight sword raised to cast | ✔ |
| zhangliang | Trương Lương | B | humanoid spear warrior rebel | rough rebel captain, stubbly peasant face, yellow turban, patched brown clothes with a few rusty armor plates, yellow sash, ONE crude spear | ✔ |
| gongsunzan | Công Tôn Toản | K | humanoid spear warrior knight | noble northern commander, short beard, white horsehair plume, white and silver armor, white cape, ONE long spear | ✔ |
| liubiao | Lưu Biểu | M | humanoid mage caster scholar | elderly dignified governor-scholar, long grey-white beard, tall official hat, deep green and brown scholar robes, ONE rolled bamboo scroll | ✔ |
| mateng | Mã Đằng | K | humanoid saber sword warrior general | weathered western frontier warlord, grey-streaked beard, fur hat, fur-trimmed leather and bronze armor, ONE long curved sabre | ✔ |
| chengong | Trần Cung | M | humanoid mage caster strategist fan | upright serious advisor, thin face, short black beard, simple black cap, plain grey-blue scholar robe, ONE folding paper fan | ✔ |
| gaoshun | Cao Thuận | B | humanoid shield spear knight tank | austere disciplined commander, plain face, closed helmet, full heavy dark steel armor, dark red cloak, a tall iron shield and ONE short spear | ✔ |
| huatuo | Hoa Đà | M | humanoid staff healer priest | kindly old physician, long white beard, white hair bun, simple beige and green robes, herb pouch at the belt, ONE wooden walking staff with a hanging medicine gourd | ✔ |
| zuoci | Tả Từ | M | humanoid mage caster taoist | mysterious Taoist immortal, one blind white eye, long white hair and beard, stooped, tattered dark blue-grey Taoist robe, straw sandals, ONE horsehair whisk | ✔ |
| menghuo | Mạnh Hoạch | B | humanoid club heavy barbarian warrior | huge tanned muscular barbarian king, wild black hair, feathered headdress, bone necklace, tiger skin and rattan armor, ONE massive spiked wooden club | ✔ |
## Linh thú của chiến pháp (`assets/beasts/<id>/`)
Chỉ tướng nào có linh thú trong tích truyện mới gọi thú. Tải về bằng `./tamquoc/tools/pull.ps1 -Id <id> -Kind beasts`.
Bảng tướng → hiệu ứng ở `src/data/vfx.js`. Mọi mô tả kết thúc bằng: `A creature only: no rider, no human, no weapon`.

| id | Linh thú | Tướng | Từ khóa (chọn rig) |
|---|---|---|---|
| shenlong | Thanh Long (rồng phương Đông thân dài) | Quan Vũ | snake serpent long body |
| baihu | Bạch Hổ | Triệu Vân | quadruped tiger beast big cat |
| wenhu | Hổ vằn ("Hổ Si") | Hứa Chử | quadruped tiger beast big cat |
| canglang | Sói xám ("Lang Cố") | Tư Mã Ý | quadruped wolf beast |
| fengchu | Phượng ("Phượng Sồ") | Bàng Thống | flying bird phoenix |
| xiaotian | Hao Thiên Khuyển | Dương Tiễn | quadruped wolf beast |
| zhanxiang | Voi chiến | Mạnh Hoạch | quadruped elephant beast |

- **Thanh Long của Quan Vũ**: từ khóa có chữ `dragon` ra thằn lằn bốn chân; từ khóa `snake serpent long body` mới ra rig thân dài (145x93, có `idle`, `walk`, `attack` phun hơi, `die`). Hình rồng là sprite (animation `walk`), được cho bay theo đường do code tính, kiểu `dragon` trong `src/vfx.js`: Quan Vũ giơ đao, rồng xoáy lên từ mũi đao, lượn 1,5 vòng trên trời (xa thì nhỏ và nằm sau mây), đao chém xuống thì rồng lao xuyên cột địch từ trên xuống. Lưỡi đao sáng, mây, sét, vệt sáng dọc cột vẽ bằng code. Sprite chỉ cao 79 điểm ảnh nên vẽ ở khoảng 2,2 lần; to hơn sẽ nhòe.
- 14 sheet đã gen nhưng không còn dùng nằm ở `sprites/beasts-unused/` (ngoài game): thanhlong, wolong, jiaolong, huolong, qilin, yinshi, jinying, darkraven, zhuque, xuanwu, chitu, shenlu, xianhe, heixiong. Hai sheet thử `zhangfei-cavalry`, `zhaoyun-cavalry` ở `sprites/*-sheet/`.
- Trên server còn 3 sprite đã hủy giữa chừng: `qinglong`, `azuredragon`, `yeya`.
- Hướng linh thú: coi như vẽ quay trái giống tướng; số đo không đủ rõ. Con nào quay lưng về phía địch thì thêm `facing: "right"` vào `BEASTS` trong `src/data/vfx.js`.

## Ghi chú
- Chỉ sửa (`fix`) các animation game dùng: `idle`, `walk`, `attack`, `skill01` (hoặc skill riêng của rig), `die`. `cuttrees` và `mine` bị server báo lỗi thì bỏ qua.
- Bỏ qua: pangtong `cuttrees`/`mine`, jiangwei `mine`, xiahoudun `cuttrees` (server báo thừa tay/thừa vũ khí; game không dùng).
- pangtong `skill02`: 18% điểm ảnh xanh lá (có thể là hiệu ứng phép); game dùng `skill01`.
- Chấp nhận dù server báo lỗi ở `die`: luxun, taishici, nezha (vũ khí nằm cạnh tướng ngã; server chê vì khung gốc không có vũ khí).
- Bỏ qua thêm (`cuttrees`/`mine`): sunquan, huanggai, luxun, zhoutai, jiling, yuanshu, zhangbao, zhangliang, diaochan.
- Rig gậy phép 147x153 (pangtong, zhangjiao, zhangbao, zuoci) có 4–18% điểm ảnh xanh lá ở `attack`/`skill`: nhiều khả năng là hiệu ứng phép của rig, cần mắt người xem.
- ganning `attack`: hình phình gấp 2 so với lúc đứng (có thể là vệt chém).
- Hướng mặt: **mọi sheet đều vẽ quay trái**; game lật hình khi tướng phải nhìn sang phải. Bảng đoán `FACES_RIGHT` cũ (rig 143x108 và 129x102 quay phải) là sai và đã bỏ. `tools/spritecheck.mjs` đo tóc–mặt để kiểm: 46/52 tướng ra "trái" rõ ràng; dianwei, huaxiong, wenchou đo ra "phải" và pangtong, weiyan, zhouyu không rõ (hói, râu rậm, nón che), nhưng tướng cùng rig với họ đều ra "trái". Tướng nào thực tế vẽ quay phải thì thêm `facing: "right"` vào `src/data/generals.js`.
- Tướng cưỡi ngựa: 11 tướng đều mất ngựa ở lần vẽ đầu và đã `fix` `walk`, `attack`, `die` (machao chỉ `walk`, `die`). Sau khi sửa, diện tích hình đo được bằng 0,74–1,4 lần lúc đứng (trước khi sửa 0,45–0,7), nên ngựa đã có lại theo số đo; chưa ai nhìn bằng mắt.
- Còn lỗi server báo sau 2 lần `fix`: yangjian `skill01` (khung 8 thừa một cây đao), wenchou `attack` (khung 5 thừa một vũ khí nằm ngang). sunce `attack`: khung 4 và 8 lệch dáng so với rig (IoU 0,28). zhangliao `die`: kích nằm cạnh tướng ngã (đúng ý).
- Mỗi rig có bộ animation riêng (vd. xuhuang/dianwei: `jls_skill` thay cho `skill01`; weiyan: `skill01` 54 khung). Game tự chọn.
