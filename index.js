require('dotenv').config();

const { initTheme } = require('./src/theme-store');
const { warnIfNoPassword } = require('./src/auth');
const discord = require('./src/discord');
const presence = require('./src/presence');
const { startServer } = require('./src/server');

initTheme();
warnIfNoPassword();
console.log('🖼️ Ảnh idle dùng URL công khai → RichPresence.getExternal() (mp:external). Dự phòng: upload Discord CDN.');

discord.onReady(() => {
    presence.handleReady();
});

startServer();
discord.startDiscord();
