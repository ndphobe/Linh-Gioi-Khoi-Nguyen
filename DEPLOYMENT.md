# Deploy Vercel + Render

Game dùng một server authoritative chạy liên tục để sinh quái, xử lý combat,
loot, phòng multiplayer và phát snapshot 20 Hz. Vì vậy bản production gồm:

- Vercel: giao diện Vite tĩnh.
- Render: Express + Socket.IO + game simulation.

Không chuyển logic quái sang client; server vẫn là nguồn chân lý như khi chạy
local.

## 1. Deploy backend lên Render

1. Push repository lên GitHub.
2. Trong Render chọn **New > Blueprint** và chọn repository này. Render sẽ đọc
   `render.yaml`.
3. Khi Render hỏi `CORS_ORIGIN`, nhập chính xác origin Vercel, ví dụ
   `https://linh-gioi-khoi-nguyen.vercel.app`. Không thêm dấu `/` cuối URL.
4. Deploy và mở `https://<render-service>.onrender.com/api/health`. Kết quả phải
   có `"ok": true`.

Có thể cho phép nhiều frontend bằng danh sách phân cách bởi dấu phẩy:

```text
https://game.example.com,https://linh-gioi-khoi-nguyen.vercel.app
```

Render Free có thể ngủ khi không có truy cập, nên lần kết nối đầu tiên có thể
chậm. Nâng plan nếu cần server game luôn sẵn sàng. File save
`.data/sessions.json` cần persistent disk hoặc database nếu muốn giữ tiến trình
qua mỗi lần deploy/restart; gameplay trong lúc server đang chạy không bị ảnh
hưởng.

## 2. Cấu hình frontend Vercel

Frontend mặc định kết nối tới service Render của repository. Khi chuyển sang
một backend khác, trong **Vercel > Project > Settings > Environment Variables**
thêm biến ghi đè:

```text
VITE_SERVER_URL=https://<render-service>.onrender.com
```

Chọn Production, Preview và Development nếu dùng cả ba môi trường. Sau đó
redeploy Vercel vì biến `VITE_*` được nhúng vào bundle lúc build.

## 3. Kiểm tra

1. Truy cập URL `/api/health` của Render.
2. Mở game Vercel; trạng thái phải báo máy chủ sẵn sàng.
3. Vào phòng và kiểm tra có quái.
4. Mở hai cửa sổ, nhập cùng mã phòng và xác nhận thấy cả hai nhân vật.

Nếu trạng thái cứ báo đang kết nối lại, kiểm tra DevTools > Network > WS và đối
chiếu `VITE_SERVER_URL` cùng `CORS_ORIGIN`. Cả hai URL production phải dùng
HTTPS.

## Chạy local

Không cần tạo `.env`:

```powershell
npm.cmd install
npm.cmd run dev
```

Client tự kết nối cùng origin `http://localhost:3000`, nên luồng local hiện tại
được giữ nguyên.
