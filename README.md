# 🚀 Discord 24/7 Rich Presence Selfbot

Treo trạng thái Rich Presence hoạt động 24/7 trên Cloud (Render, Koyeb, Railway, VPS).

Theme mặc định là **Miku Nakano** (中野三玖), em thứ ba trong *Gotoubun no Hanayome* / *The Quintessential Quintuplets*: ít nói, tai nghe xanh, matcha soda, mê võ tướng thời Sengoku, sinh nhật 5/5, màu xanh, số 3.

Mở bảng điều khiển tại `/` để xem presence và chỉnh theme, không cần sửa code.

---

## 🎛️ Bảng điều khiển

Chạy `npm start`, rồi mở `http://localhost:3000`.

Trang gồm:

- Trạng thái trực tiếp: tài khoản đã đăng nhập, kết nối, chế độ (theme Miku / đang phát nhạc / tạm dừng), bài hát và dòng lời.
- Thẻ xem trước giống Rich Presence trên Discord: tên, details, state, ảnh lớn, ảnh nhỏ, nút, đồng hồ.
- Form chỉnh theme: tên, các câu xoay (thêm, sửa, xóa, đổi thứ tự), chu kỳ, URL ảnh và chữ hover, nút bấm, Application ID.
- Thao tác nhanh: tạm dừng / tiếp tục, làm mới, kết nối lại, xóa nhạc.

Bấm **Lưu và áp dụng** thì presence đổi ngay. Bản lưu nằm ở `data/theme.json` (đã gitignore) và còn sau khi khởi động lại trên cùng máy. **Đặt lại theme Miku** xóa file đó và dùng lại `themes/miku.js`.

Khi chưa có `data/theme.json`, biến môi trường (`CLIENT_ID`, `RPC_NAME`, `ROTATE_INTERVAL_MS`, ảnh, nút) vẫn ghi đè file theme lúc khởi động. Sau khi lưu trên bảng, file JSON là bản đang chạy.

`DASHBOARD_PASSWORD`:

- Có mật khẩu: phải đăng nhập mới xem bảng và mới gọi được API ghi.
- Không đặt: bảng mở ở chế độ chỉ xem, API ghi trả về 403, process in cảnh báo. Đừng để vậy trên máy public.

`/track`, `/stop`, `/reconnect`, `/bot-status` giữ cho script nhạc trên trình duyệt. `/health` là dòng kiểm tra sống (trước đây nằm ở `/`). `/bot-status` không còn trả về mảnh token.

Giới hạn: details, state, hover và tên tối đa 128 ký tự. Nhãn nút tối đa 32. URL nút phải là http hoặc https. Chu kỳ xoay từ 20 giây đến 60 phút.

Trên Render, đĩa local bị xóa khi deploy hoặc spin-down. `data/theme.json` sẽ mất trừ khi gắn persistent disk. Xem [Ephemeral filesystem](https://render.com/deploys#ephemeral-filesystem).

---

## 🎧 Theme Miku

Khi không phát nhạc, Discord hiện **Listening to Miku Nakano**. Details và state đổi mỗi 60 giây. Ảnh lớn / ảnh nhỏ kèm chữ khi hover. Đồng hồ đếm từ lúc process chạy.

### Presence lúc idle (một trong các cặp, xoay vòng)

| Details | State |
| --- | --- |
| 🎧 Blue headphones, world on mute | 中野三玖 · the third sister |
| 🍵 Matcha soda, the usual | Quiet corner, favorite drink |
| 📜 One more chapter of the Sengoku era | Takeda Shingen's crest is still her wallpaper |
| 💙 May 5 · her color is blue | 三 means three, and she is the third |
| 🏯 Sengoku generals, read in secret | Best subject: social studies |
| "Failure is the stepping stone to success, right?" | Soft voice. Then she tries again. |
| "Don't ask me. Coming up with the answer to that is your job, isn't it?" | Quiet, until she decides to be direct |
| 🤫 Bangs over one eye | Headphones rest around her neck |

Hai câu trong ngoặc kép là thoại của Miku (manga chương 50 và chương 5).

### Ảnh

| | Nguồn | Hover |
| --- | --- | --- |
| Ảnh lớn | [AniList CDN](https://s4.anilist.co/file/anilistcdn/character/large/b126373-CWeyXb822uDN.png) (chân dung Miku, từ 2019) | 🎧 中野三玖 · Miku Nakano |
| Ảnh nhỏ | [MyAnimeList CDN](https://cdn.myanimelist.net/images/characters/15/507743.jpg) | The third sister · image color blue |

`CLIENT_ID` mặc định là application của tác giả gốc, nên asset upload trên Developer Portal của app đó không dùng được. `discord.js-selfbot-v13` 3.7.1 nhận `mp:`, `external/` (thêm `mp:`), `youtube:`, `spotify:`, `twitch:`, asset id, hoặc URL `cdn.discordapp.com` / `media.discordapp.net`. URL http khác bị ném `INVALID_URL`.

Bot gửi URL công khai qua `RichPresence.getExternal(client, CLIENT_ID, url)` và gắn `external_asset_path` (`mp:external/...`). Nếu Discord từ chối, bot tải ảnh lên kênh `bot-storage` rồi dùng URL CDN — cùng đường với ảnh bìa SoundCloud / Apple Music.

### Khi đang nghe nhạc

Lời đồng bộ, timestamp và ảnh bìa giữ nguyên. Tên đổi thành **Miku Nakano**, dòng bài hát dùng 🎧, dòng ca sĩ dùng 💙, lời trên ảnh vẫn là 🎤. Ảnh nhỏ là chân dung Miku. Nút "nghe trên …" giữ chỗ đầu; nút thứ hai lấy từ theme (mặc định wiki Miku).

---

## 🛠️ Hướng dẫn cài đặt & chạy Local

1. Cài đặt các gói phụ thuộc:
   ```bash
   npm install
   ```

2. Tạo file `.env`:
   ```env
   DISCORD_TOKEN=your_token_here
   PORT=3000
   DASHBOARD_PASSWORD=mot-mat-khau-dai
   THEME=miku
   # CLIENT_ID=your_application_id
   ```

3. Chạy script:
   ```bash
   npm start
   ```

4. Mở `http://localhost:3000`, đăng nhập bằng `DASHBOARD_PASSWORD`.

Thiếu `DISCORD_TOKEN` thì process vẫn mở web server và in `NO_TOKEN_CONFIGURED`. Không commit file `.env` hay `data/theme.json`.

---

## ☁️ Hướng dẫn treo 24/7 trên Render (Miễn phí)

1. Đăng nhập [Render.com](https://render.com/).
2. Chọn **New +** ➜ **Web Service**.
3. Kết nối với GitHub Repository `sigma-69/selfbot`.
4. Điền cấu hình:
   * **Runtime**: `Node`
   * **Build Command**: `npm install`
   * **Start Command**: `npm start`
   * **Health Check Path**: `/health`
5. Ở mục **Environment Variables**, thêm biến:
   * `DISCORD_TOKEN` = `[Token của bạn]`
   * `DASHBOARD_PASSWORD` = `[Mật khẩu bảng điều khiển]`
   * `THEME` = `miku` (tuỳ chọn)
   * `CLIENT_ID` = `[Application ID của bạn]` (tuỳ chọn, nên có nếu ảnh external lỗi)
6. Bấm **Deploy Web Service**.

Sau khi deploy, mở URL của service, đăng nhập, rồi chỉnh theme trên bảng.
