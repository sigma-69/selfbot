const fs = require('fs');
const path = require('path');

const LIMIT = 128;
const BUTTON_LABEL_LIMIT = 32;
const MIN_ROTATE_MS = 20000;

function clip(text, max = LIMIT) {
    if (text == null) return '';
    const value = String(text).replace(/\s+/g, ' ').trim();
    return value.length <= max ? value : value.slice(0, max);
}

function validHttp(url) {
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
}

function applyEnv(theme) {
    const next = {
        id: theme.id || 'miku',
        clientId: theme.clientId,
        name: clip(theme.name || 'Miku Nakano'),
        rotateIntervalMs: Number(theme.rotateIntervalMs) || 60000,
        largeImage: theme.largeImage || '',
        largeText: clip(theme.largeText || ''),
        smallImage: theme.smallImage || '',
        smallText: clip(theme.smallText || ''),
        lines: (theme.lines || [])
            .map(line => ({
                details: clip(line.details),
                state: clip(line.state),
            }))
            .filter(line => line.details || line.state),
        buttons: (theme.buttons || [])
            .filter(button => button && button.label && button.url && validHttp(button.url))
            .slice(0, 2)
            .map(button => ({
                label: clip(button.label, BUTTON_LABEL_LIMIT),
                url: button.url,
            })),
        music: {
            songEmoji: theme.music?.songEmoji || '🎧',
            artistEmoji: theme.music?.artistEmoji || '💙',
            lyricEmoji: theme.music?.lyricEmoji || '🎤',
            platformEmoji: theme.music?.platformEmoji || '✨',
            listenEmoji: theme.music?.listenEmoji || '▶️',
        },
    };

    const clientId = (process.env.CLIENT_ID || '').trim();
    if (clientId) {
        if (/^[0-9]{17,19}$/.test(clientId)) {
            next.clientId = clientId;
        } else {
            console.warn('⚠️ CLIENT_ID không phải snowflake Discord (17-19 chữ số). Giữ id trong file theme.');
        }
    }

    const name = (process.env.RPC_NAME || '').trim();
    if (name) next.name = clip(name);

    const rotate = (process.env.ROTATE_INTERVAL_MS || '').trim();
    if (rotate) {
        const ms = parseInt(rotate, 10);
        if (Number.isFinite(ms)) {
            if (ms < MIN_ROTATE_MS) {
                console.warn(`⚠️ ROTATE_INTERVAL_MS quá thấp, đặt lại ${MIN_ROTATE_MS}ms.`);
            }
            next.rotateIntervalMs = Math.max(MIN_ROTATE_MS, ms);
        }
    }
    if (!Number.isFinite(next.rotateIntervalMs) || next.rotateIntervalMs < MIN_ROTATE_MS) {
        next.rotateIntervalMs = Math.max(MIN_ROTATE_MS, 60000);
    }

    const largeImage = (process.env.LARGE_IMAGE_URL || '').trim();
    if (largeImage) next.largeImage = largeImage;
    const largeText = (process.env.LARGE_IMAGE_TEXT || '').trim();
    if (largeText) next.largeText = clip(largeText);
    const smallImage = (process.env.SMALL_IMAGE_URL || '').trim();
    if (smallImage) next.smallImage = smallImage;
    const smallText = (process.env.SMALL_IMAGE_TEXT || '').trim();
    if (smallText) next.smallText = clip(smallText);

    for (const slot of [1, 2]) {
        const label = (process.env[`BUTTON_${slot}_LABEL`] || '').trim();
        const url = (process.env[`BUTTON_${slot}_URL`] || '').trim();
        if (!label && !url) continue;
        if (!label || !validHttp(url)) {
            console.warn(`⚠️ BUTTON_${slot}_LABEL và BUTTON_${slot}_URL cần đủ cả hai (URL http/https). Bỏ qua.`);
            continue;
        }
        next.buttons[slot - 1] = { label: clip(label, BUTTON_LABEL_LIMIT), url };
    }
    next.buttons = next.buttons.filter(Boolean).slice(0, 2);

    if (!next.lines.length) {
        next.lines.push({
            details: '🎧 Blue headphones, world on mute',
            state: '中野三玖 · the third sister',
        });
    }

    return next;
}

function loadTheme() {
    const requested = (process.env.THEME || 'miku').trim().toLowerCase() || 'miku';
    const safe = requested.replace(/[^a-z0-9_-]/g, '');
    const file = path.join(__dirname, `${safe}.js`);

    let theme;
    if (safe && fs.existsSync(file)) {
        theme = require(file);
    } else {
        console.warn(`⚠️ Không tìm thấy themes/${requested}.js — dùng themes/miku.js.`);
        theme = require('./miku.js');
    }

    return applyEnv(theme);
}

function idleLine(theme, now = Date.now()) {
    const index = Math.floor(now / theme.rotateIntervalMs) % theme.lines.length;
    return { index, ...theme.lines[index] };
}

module.exports = {
    loadTheme,
    clip,
    idleLine,
    LIMIT,
    BUTTON_LABEL_LIMIT,
    MIN_ROTATE_MS,
};
