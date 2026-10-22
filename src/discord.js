const { Client } = require('discord.js-selfbot-v13');
const state = require('./state');

const client = new Client({ checkUpdate: false });

client.on('error', err => {
    state.lastWsError = `client_error: ${err.message}`;
    console.error('Client Error:', err.message);
});
client.on('shardError', err => {
    state.lastWsError = `shard_error: ${err.message}`;
    console.error('Shard Error:', err.message);
});
client.on('warn', warn => {
    state.lastWsError = `warn: ${warn}`;
    console.warn('Warn:', warn);
});

function onReady(handler) {
    client.on('ready', handler);
}

async function initStorageChannel() {
    try {
        const ownedGuild = client.guilds.cache.find(guild => guild.ownerId === client.user.id);
        if (!ownedGuild) return null;

        let channel = ownedGuild.channels.cache.find(item => item.name === 'bot-storage');
        if (!channel) {
            channel = await ownedGuild.channels.create('bot-storage', {
                type: 'GUILD_TEXT',
                topic: 'Private storage for music album covers',
                permissionOverwrites: [
                    {
                        id: ownedGuild.roles.everyone.id,
                        deny: ['VIEW_CHANNEL'],
                    },
                    {
                        id: client.user.id,
                        allow: ['VIEW_CHANNEL', 'SEND_MESSAGES', 'ATTACH_FILES'],
                    },
                ],
            });
            console.log('📁 Đã tạo kênh lưu trữ ảnh bìa bảo mật:', channel.id);
        }
        state.storageChannel = channel;
        return channel;
    } catch (err) {
        console.error('⚠️ Không thể khởi tạo storage channel:', err.message);
        return null;
    }
}

async function ensureDiscordLogin() {
    if (client.user && client.ws && client.ws.status === 0) return;
    if (state.isLoggingIn) return;

    const rawToken = process.env.DISCORD_TOKEN;
    if (!rawToken) {
        state.loginError = 'NO_TOKEN_CONFIGURED';
        if (!state.loggedMissingToken) {
            state.loggedMissingToken = true;
            console.log('⚠️ NO_TOKEN_CONFIGURED — thiếu DISCORD_TOKEN. Server vẫn chạy, chưa đăng nhập Discord.');
        }
        return;
    }

    const cleanToken = rawToken.trim().replace(/^['"]|['"]$/g, '');
    if (client.ws && client.ws.destroyed) client.ws.destroyed = false;
    state.isLoggingIn = true;
    console.log(`🔄 [Auto-Login] Đang đăng nhập Discord với Token length ${cleanToken.length}...`);

    try {
        await client.login(cleanToken);
        state.loginError = null;
        console.log(`🎉 [Auto-Login] Đăng nhập thành công: ${client.user?.tag}`);
    } catch (err) {
        state.loginError = err.message;
        console.error('❌ [Auto-Login] Lỗi khi đăng nhập Discord:', err.message);
    } finally {
        state.isLoggingIn = false;
    }
}

async function reconnectDiscord() {
    if (client.ws && client.ws.destroyed) client.ws.destroyed = false;
    await ensureDiscordLogin();
    return {
        ok: !!client.user,
        userTag: client.user ? client.user.tag : null,
        wsStatus: client.ws ? client.ws.status : -1,
        loginError: state.loginError,
    };
}

function startDiscord() {
    ensureDiscordLogin();
    setInterval(() => {
        if (!client.user || (client.ws && client.ws.status !== 0 && client.ws.status !== 1)) {
            ensureDiscordLogin();
        }
    }, 8000);
}

function wsStatus() {
    return client.ws ? client.ws.status : -1;
}

module.exports = {
    client,
    onReady,
    initStorageChannel,
    ensureDiscordLogin,
    reconnectDiscord,
    startDiscord,
    wsStatus,
};
