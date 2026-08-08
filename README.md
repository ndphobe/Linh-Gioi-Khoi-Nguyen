# Tu Tiên Truyền Kỳ — bản chơi thử online

Đây là **vertical slice** của ý tưởng game tu tiên hành động góc nhìn thứ ba trong GDD. Mục tiêu của bản này là chứng minh vòng lặp cốt lõi — vào phòng, điều khiển nhân vật, chiến đấu, tích tụ tu vi và vượt lôi kiếp từ **Trúc Cơ** lên **Kim Đan** — chứ chưa phải một MMORPG hoàn chỉnh.

## Phạm vi hiện có

- Đấu trường 3D góc nhìn sau vai với phong cách pixel-art 32-bit: render nội bộ độ phân giải thấp, nearest-neighbor, toon 4 bậc và texture pixel.
- Chọn tên và một trong ba phe: Chính Đạo, Ma Đạo hoặc Tà Đạo.
- Di chuyển, ngắm, đánh thường, né/lướt và sử dụng bộ kỹ năng Q/E/R/F/G.
- Quái thường, các kiểu hành vi chiến đấu và một cuộc chạm trán cao trào.
- Tu vi, nhiệm vụ hướng dẫn, tĩnh tọa và thử thách ba đợt lôi kiếp Trúc Cơ → Kim Đan.
- Phòng chơi online nhẹ để nhiều trình duyệt có thể nhìn thấy trạng thái của nhau trong cùng mã phòng.
- Giao diện lưu đạo hiệu, phe và cột mốc cảnh giới bằng `localStorage`; quyền chiến đấu và phần thưởng trong phiên vẫn thuộc máy chủ.
- Đột phá Kim Đan mở khóa Ngự Kiếm Phi Hành và chặng bay qua ba Tiên Hoàn để kết thúc bản thử nghiệm.

Toàn bộ chín cảnh giới vẫn được khai báo trong dữ liệu để định hình đường phát triển, nhưng bản chơi thử **chỉ triển khai bước đột phá Trúc Cơ → Kim Đan**.

## Hướng mỹ thuật pixel

- Gameplay vẫn dùng không gian 3D và camera tự do để giữ ngắm, né, khóa mục tiêu và đồng bộ online; chỉ lớp trình bày được pixel hóa.
- Kích thước drawing buffer tự chọn theo một hệ số nguyên quanh mốc 360p, sau đó canvas được phóng bằng nearest-neighbor. Vì vậy chuyển động/network vẫn chạy mượt trong khi từng ô pixel luôn rõ.
- Nhân vật, quái và kiến trúc dùng vật liệu toon phân bậc, bóng cứng, silhouette chibi và bảng màu đêm xanh ngọc – sơn son – vàng cổ.
- Màn chọn môn phái dùng key art pixel nguyên bản tại `public/assets/onboarding-palace-pixel.png`; UI dùng viền cứng, bóng lệch bậc và animation `steps()`.
- Heaven's Relic chỉ là tham chiếu cấp cao cho ngôn ngữ pixel tu tiên. Toàn bộ cảnh, nhân vật, phù văn và giao diện trong prototype này là thiết kế nguyên bản.

## Cài đặt và chạy

Yêu cầu Node.js 20 trở lên. Trên PowerShell của máy phát triển này, hãy dùng `npm.cmd` vì execution policy có thể chặn `npm.ps1`.

```powershell
npm.cmd install
npm.cmd run dev
```

Lệnh `dev` khởi động chung máy chủ Express/Socket.IO, mô phỏng authoritative 20 Hz và Vite middleware trong **một terminal**. Mở `http://localhost:3000`; để kiểm tra nhiều người chơi, mở thêm một cửa sổ hoặc trình duyệt khác rồi nhập cùng mã phòng.

Kiểm tra logic thuần và tạo bản production:

```powershell
npm.cmd test
npm.cmd run build
npm.cmd start
npm.cmd run smoke:network
```

`npm.cmd start` phục vụ thư mục `dist` ở chế độ production nên cần chạy `build` trước. Có thể đổi cổng bằng biến môi trường `PORT`; mặc định là `3000`. Client và server phòng chơi phải cùng hoạt động để đồng bộ online; giao diện phải báo rõ trạng thái mất kết nối thay vì giả vờ đã đồng bộ.

## Điều khiển

| Phím | Hành động |
| --- | --- |
| `W A S D` | Di chuyển |
| Chuột | Xoay camera / ngắm |
| Chuột trái | Kiếm Khí — đánh thường |
| Chuột phải | Đỡ đòn / pháp bảo |
| `Space` | Nhảy / khinh công |
| `Shift` | Lướt né có thời gian vô địch ngắn |
| `Q` | Định Thân Phù |
| `E` | Vạn Kiếm Quy Tông |
| `R` | Trảm Tiên Trảm Địa |
| `F` | Khiên Linh Lực |
| `G` | Hóa Thần Biến |
| `Tab` | Khóa / đổi mục tiêu khi chế độ đó khả dụng |
| `C` | Bắt đầu / kết thúc tĩnh tọa trong khu an toàn |
| `B` | Kích hoạt đột phá khi đứng tại Trận Pháp |
| `V` hoặc `T` | Triệu hồi / thu hồi phi kiếm sau Kim Đan |
| `M` | Mở hoặc đóng bản đồ |
| `Esc` | Thả chuột hoặc mở menu |

## Kiến trúc dữ liệu và luật

- `src/game/data.js` chứa dữ liệu bất biến theo hướng cấu hình: phe phái, kỹ năng, cảnh giới, nhiệm vụ và mẫu kẻ địch.
- `src/game/rules.js` chứa các hàm thuần để chuẩn hóa đầu vào, tính tiến độ tu luyện, xử lý đột phá, sinh mục tiêu nhiệm vụ và tuần tự hóa hồ sơ.
- `tests/rules.test.js` dùng test runner tích hợp của Node, không cần framework test phía ngoài.

Các module luật không truy cập màn hình, bộ nhớ trình duyệt hay kết nối mạng. Cách tách này cho phép client và server cùng dùng một quy tắc, đồng thời giữ test nhanh và xác định.

## Mô hình online của prototype

Phòng chơi hiện tại chỉ nên được xem là networking thử nghiệm:

- Mã phòng dài 3–12 ký tự được chuẩn hóa trước khi tham gia; mỗi phòng chứa tối đa 8 người.
- Client gửi **ý định điều khiển** và nhận snapshot trạng thái thay vì được quyền quyết định vật phẩm, sát thương hoặc cảnh giới lâu dài.
- Máy chủ hiện là nguồn chân lý cho giới hạn di chuyển, cooldown, sát thương, phần thưởng, tu vi và kết quả đột phá; snapshot công khai và trạng thái riêng được phát ở 20 Hz.
- Client nội suy snapshot; server giới hạn gói di chuyển, tốc độ, dash, cooldown và cửa sổ phản đòn. Vẫn cần xác thực tài khoản, reconciliation nâng cao, chống gian lận và lưu dữ liệu phía server trước khi có kinh tế hoặc PvP xếp hạng.

Không nên mở rộng thẳng lên 50 người. Bước kế tiếp hợp lý là ổn định phòng 4–8 người và đấu 1v1, đo tải rồi mới thêm phân vùng bản đồ hoặc interest management.

## Chưa nằm trong prototype

- Tám bước đột phá còn lại, phi thăng và hệ thống tẩu hỏa/đoạt xá đầy đủ.
- Thế giới mở, chuyển vùng, bí cảnh năm người, tháp 100 tầng và chiến tranh tông môn.
- Xây động phủ, linh điền, phòng thủ/cướp tài nguyên và song tu.
- Luyện đan, luyện khí, trang bị có chiều sâu, linh thú và đấu giá giữa người chơi.
- Tài khoản thật, cơ sở dữ liệu, chat/voice, matchmaking, máy chủ chuyên dụng và anti-cheat.
- Model/animation/âm thanh/VFX ở chất lượng sản xuất; hiện tại dùng mô hình chibi toon được pixel hóa, âm thanh thủ tục và key art pixel nguyên bản cho prototype. Chưa cân bằng năm hệ phái hay tối ưu 4K/120 FPS.
- Tiền nạp hoặc giao dịch giá trị thật. Các hệ thống này chỉ nên được thiết kế sau khi gameplay, bảo mật và kinh tế đã được kiểm chứng.
