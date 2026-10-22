const axios = require('axios');
const { RichPresence } = require('discord.js-selfbot-v13');
const state = require('./state');
const { getTheme } = require('./theme-store');

const cdnImageCache = new Map();
const externalCache = new Map();
const loggedFailures = new Set();

function getClient() {
    return require('./discord').client;
}

function assetKind(image) {
    if (!image || typeof image !== 'string') return 'empty';
    if (['mp:', 'youtube:', 'spotify:', 'twitch:'].some(prefix => image.startsWith(prefix))) return 'direct';
    if (image.startsWith('external/')) return 'direct';
    if (/^[0-9]{17,19}$/.test(image)) return 'direct';
    try {
        const url = new URL(image);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') return 'invalid';
        if (url.hostname === 'cdn.discordapp.com' || url.hostname === 'media.discordapp.net') return 'direct';
        return 'external';
    } catch {
        return 'invalid';
    }
}

function logFailureOnce(image, message) {
    const key = `${image}::${message}`;
    if (loggedFailures.has(key)) return;
    loggedFailures.add(key);
    console.error(message);
}

async function uploadToDiscordCDN(imageUrl) {
    if (!imageUrl || (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://'))) {
        return null;
    }
    if (cdnImageCache.has(imageUrl)) return cdnImageCache.get(imageUrl);
    if (!state.storageChannel) return null;

    try {
        console.log(`🖼️ Đang nạp ảnh lên Discord CDN: ${imageUrl}`);
        const response = await axios.get(imageUrl, {
            responseType: 'arraybuffer',
            timeout: 5000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
        });
        const msg = await state.storageChannel.send({
            files: [{ attachment: response.data, name: 'cover.jpg' }],
        });
        const cdnUrl = msg.attachments.first()?.url;
        if (cdnUrl) {
            cdnImageCache.set(imageUrl, cdnUrl);
            console.log('✨ Đã nạp ảnh lên Discord CDN.');
            return cdnUrl;
        }
    } catch (err) {
        console.error('❌ Lỗi uploadToDiscordCDN:', err.message);
    }
    return null;
}

async function resolveOneExternal(image) {
    const kind = assetKind(image);
    if (kind === 'empty' || kind === 'invalid') return null;
    if (kind === 'direct') return image;
    if (externalCache.has(image)) return externalCache.get(image);

    const client = getClient();
    const clientId = getTheme().clientId;
    if (client.token && /^[0-9]{17,19}$/.test(clientId || '')) {
        try {
            const res = await RichPresence.getExternal(client, clientId, image);
            const match = Array.isArray(res)
                ? res.find(item => item && item.url === image) || res[0]
                : null;
            if (match && match.external_asset_path) {
                externalCache.set(image, match.external_asset_path);
                console.log(`🖼️ Ảnh theme qua getExternal: ${match.external_asset_path}`);
                return match.external_asset_path;
            }
        } catch (err) {
            logFailureOnce(image, `⚠️ getExternal thất bại: ${err.message}`);
        }
    }

    const cdnUrl = await uploadToDiscordCDN(image);
    if (cdnUrl) {
        externalCache.set(image, cdnUrl);
        console.log('🖼️ Ảnh theme qua Discord CDN.');
        return cdnUrl;
    }

    if (client.user || state.storageChannel) {
        logFailureOnce(image, '⚠️ Chưa gắn được ảnh theme. Cần getExternal thành công hoặc kênh bot-storage.');
    }
    return null;
}

async function resolveThemeImages() {
    if (state.resolvingImages) return state.resolvingImages;
    state.lastImageAttempt = Date.now();
    const theme = getTheme();
    state.resolvingImages = (async () => {
        const large = await resolveOneExternal(theme.largeImage);
        const small = await resolveOneExternal(theme.smallImage);
        state.themeImages = { large, small };
    })().finally(() => {
        state.resolvingImages = null;
    });
    return state.resolvingImages;
}

function invalidateThemeImages() {
    loggedFailures.clear();
    state.themeImages = { large: null, small: null };
    state.lastImageAttempt = 0;
    return resolveThemeImages();
}

function scheduleThemeImages() {
    const theme = getTheme();
    const needLarge = theme.largeImage && !state.themeImages.large;
    const needSmall = theme.smallImage && !state.themeImages.small;
    if (!needLarge && !needSmall) return;
    const client = getClient();
    if (!client.user || !client.token) return;
    if (state.resolvingImages) return;
    if (Date.now() - state.lastImageAttempt < 60000) return;
    resolveThemeImages().catch(err => console.error('⚠️ resolveThemeImages:', err.message));
}

module.exports = {
    assetKind,
    uploadToDiscordCDN,
    resolveThemeImages,
    invalidateThemeImages,
    scheduleThemeImages,
};
