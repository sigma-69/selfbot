/**
 * Theme Miku Nakano (中野三玖) — em thứ ba trong Gotoubun no Hanayome
 * (The Quintessential Quintuplets).
 *
 * Chất liệu dùng cho câu chữ:
 * - trầm, nhút nhát, nhưng nói thẳng khi đã mở lời
 * - mê võ tướng thời Sengoku, nhất là Takeda Shingen (huy hiệu trên điện thoại)
 * - tai nghe không dây màu xanh, logo tam giác = số 3 = thứ tự chào đời
 * - thức uống ruột: matcha soda
 * - sinh nhật 5 tháng 5, màu nhận diện xanh, tên 三 (ba) + 玖
 *
 * Hai câu trong ngoặc kép là thoại manga (bản dịch Anh trên wiki):
 * - "Failure is the stepping stone to success, right?" — chương 50
 * - "Don't ask me. Coming up with the answer to that is your job, isn't it?" — chương 5
 *
 * Ảnh là chân dung công khai, host ổn định (AniList CDN từ 2019, MyAnimeList CDN).
 * discord.js-selfbot-v13@3.7.1 ném INVALID_URL nếu đưa URL http thường vào
 * setAssetsLargeImage. index.js gọi RichPresence.getExternal() để đổi thành
 * mp:external/..., rồi mới gắn. Nếu API từ chối thì upload lên Discord CDN.
 *
 * clientId mặc định là application của tác giả gốc — không upload asset lên
 * app đó được. Đặt CLIENT_ID của bạn trong .env nếu getExternal lỗi.
 */
module.exports = {
    id: 'miku',
    clientId: '1538974355193593856',

    // Discord hiện "Listening to {name}"
    name: 'Miku Nakano',

    // Đổi details/state. Tối thiểu thực tế là 20s (themes/load.js chặn thấp hơn).
    rotateIntervalMs: 60000,

    largeImage: 'https://s4.anilist.co/file/anilistcdn/character/large/b126373-CWeyXb822uDN.png',
    largeText: '🎧 中野三玖 · Miku Nakano',

    smallImage: 'https://cdn.myanimelist.net/images/characters/15/507743.jpg',
    smallText: 'The third sister · image color blue',

    lines: [
        {
            details: '🎧 Blue headphones, world on mute',
            state: '中野三玖 · the third sister',
        },
        {
            details: '🍵 Matcha soda, the usual',
            state: 'Quiet corner, favorite drink',
        },
        {
            details: '📜 One more chapter of the Sengoku era',
            state: "Takeda Shingen's crest is still her wallpaper",
        },
        {
            details: '💙 May 5 · her color is blue',
            state: '三 means three, and she is the third',
        },
        {
            details: '🏯 Sengoku generals, read in secret',
            state: 'Best subject: social studies',
        },
        {
            details: '"Failure is the stepping stone to success, right?"',
            state: 'Soft voice. Then she tries again.',
        },
        {
            details: '"Don\'t ask me. Coming up with the answer to that is your job, isn\'t it?"',
            state: 'Quiet, until she decides to be direct',
        },
        {
            details: '🤫 Bangs over one eye',
            state: 'Headphones rest around her neck',
        },
    ],

    // Không dùng GitHub / Instagram của tác giả gốc. Đổi bằng BUTTON_* trong .env.
    buttons: [
        {
            label: 'Miku Nakano',
            url: 'https://5hanayome.fandom.com/wiki/Miku_Nakano',
        },
        {
            label: 'The Quintuplets',
            url: 'https://en.wikipedia.org/wiki/The_Quintessential_Quintuplets',
        },
    ],

    // Chế độ nhạc: lời, timestamp, ảnh bìa giữ nguyên. Chỉ đổi emoji / tên.
    music: {
        songEmoji: '🎧',
        artistEmoji: '💙',
        lyricEmoji: '🎤',
        platformEmoji: '✨',
        listenEmoji: '▶️',
    },
};
