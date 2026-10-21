# 🚀 Discord 24/7 Rich Presence Selfbot

Treo trạng thái Rich Presence hoạt động 24/7 trên Cloud (Render, Koyeb, Railway, VPS).

Theme mặc định là **Miku Nakano** (中野三玖), em thứ ba trong *Gotoubun no Hanayome* / *The Quintessential Quintuplets*: ít nói, tai nghe xanh, matcha soda, mê võ tướng thời Sengoku, sinh nhật 5/5, màu xanh, số 3.

---

## 🎧 Theme Miku

Khi không phát nhạc, Discord hiện **Listening to Miku Nakano**. Details và state đổi mỗi 60 giây. Ảnh lớn / ảnh nhỏ kèm chữ khi hover. Đồng hồ đếm từ lúc process chạy.

Mỗi dòng details, state và hover được cắt ở 128 ký tự. Nhãn nút cắt ở 32 ký tự.

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

`CLIENT_ID` mặc định là application của tác giả gốc, nên asset upload trên Developer Portal của app đó không dùng được. `discord.js-selfbot-v13` 3.7.1 (`RichPresenceAssets.parseImage`) nhận `mp:`, `external/` (thêm `mp:`), `youtube:`, `spotify:`, `twitch:`, asset id, hoặc URL `cdn.discordapp.com` / `media.discordapp.net`. URL http khác bị ném `INVALID_URL`.

Bot gửi URL công khai qua `RichPresence.getExternal(client, CLIENT_ID, url)` và gắn `external_asset_path` (`mp:external/...`). Nếu Discord từ chối, bot tải ảnh lên kênh `bot-storage` rồi dùng URL CDN — cùng đường với ảnh bìa SoundCloud / Apple Music.

### Khi đang nghe nhạc

Lời đồng bộ, timestamp và ảnh bìa giữ nguyên. Tên đổi thành **Miku Nakano**, dòng bài hát dùng 🎧, dòng ca sĩ dùng 💙, lời trên ảnh vẫn là 🎤. Ảnh nhỏ là chân dung Miku. Nút "nghe trên …" giữ chỗ đầu; nút thứ hai lấy từ theme (mặc định wiki Miku).

### Tùy chỉnh

Sửa [`themes/miku.js`](themes/miku.js), hoặc ghi đè bằng biến môi trường (env thắng file):

| Biến | Tác dụng |
| --- | --- |
| `THEME` | Tên file trong `themes/` (mặc định `miku`) |
| `CLIENT_ID` | Discord Application ID của bạn |
| `RPC_NAME` | Chữ sau "Listening to" |
| `ROTATE_INTERVAL_MS` | Chu kỳ đổi câu, tối thiểu 20000 |
| `LARGE_IMAGE_URL` | URL ảnh lớn |
| `LARGE_IMAGE_TEXT` | Hover ảnh lớn |
| `SMALL_IMAGE_URL` | URL ảnh nhỏ |
| `SMALL_IMAGE_TEXT` | Hover ảnh nhỏ |
| `BUTTON_1_LABEL` + `BUTTON_1_URL` | Nút 1 (cần đủ cả hai) |
| `BUTTON_2_LABEL` + `BUTTON_2_URL` | Nút 2 (cần đủ cả hai) |

Nút mặc định trỏ tới wiki Miku và trang Wikipedia của series. Link cá nhân của tác giả gốc không còn trong theme.

---

## 🛠️ Hướng dẫn cài đặt & chạy Local

1. Cài đặt các gói phụ thuộc:
   ```bash
   npm install
   ```

2. Tạo file `.env` và điền Token:
   ```env
   DISCORD_TOKEN=your_token_here
   PORT=3000
   THEME=miku
   # CLIENT_ID=your_application_id
   ```

3. Chạy script:
   ```bash
   npm start
   ```

Thiếu `DISCORD_TOKEN` thì process vẫn mở web server và in `NO_TOKEN_CONFIGURED`. Không commit file `.env`.

---

## ☁️ Hướng dẫn treo 24/7 trên Render (Miễn phí)

1. Đăng nhập [Render.com](https://render.com/).
2. Chọn **New +** ➜ **Web Service**.
3. Kết nối với GitHub Repository `sigma-69/selfbot`.
4. Điền cấu hình:
   * **Runtime**: `Node`
   * **Build Command**: `npm install`
   * **Start Command**: `npm start`
5. Ở mục **Environment Variables**, thêm biến:
   * `DISCORD_TOKEN` = `[Token của bạn]`
   * `THEME` = `miku` (tuỳ chọn)
   * `CLIENT_ID` = `[Application ID của bạn]` (tuỳ chọn, nên có nếu ảnh external lỗi)
6. Bấm **Deploy Web Service**.
