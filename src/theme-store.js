const fs = require('fs');
const path = require('path');
const { loadTheme } = require('../themes/load');

const THEME_FILE = path.join(__dirname, '..', 'data', 'theme.json');
const MIN_ROTATE_MS = 20000;
const MAX_ROTATE_MS = 60 * 60 * 1000;
const TEXT_LIMIT = 128;
const BUTTON_LIMIT = 32;
const MAX_LINES = 24;

let active = null;
let customized = false;
let revision = 1;

function validHttp(url) {
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
}

function isAllowedImage(value) {
    if (!value) return true;
    if (['mp:', 'youtube:', 'spotify:', 'twitch:'].some(prefix => value.startsWith(prefix))) return true;
    if (value.startsWith('external/')) return true;
    if (/^[0-9]{17,19}$/.test(value)) return true;
    return validHttp(value);
}

function sanitizeMusic(music, fallback) {
    const base = {
        songEmoji: '🎧',
        artistEmoji: '💙',
        lyricEmoji: '🎤',
        platformEmoji: '✨',
        listenEmoji: '▶️',
        ...(fallback || {}),
    };
    if (!music || typeof music !== 'object') return base;
    const out = { ...base };
    for (const key of ['songEmoji', 'artistEmoji', 'lyricEmoji', 'platformEmoji', 'listenEmoji']) {
        if (typeof music[key] === 'string' && music[key].trim() && [...music[key].trim()].length <= 8) {
            out[key] = music[key].trim();
        }
    }
    return out;
}

function textField(value) {
    return typeof value === 'string' ? value.trim() : null;
}

/**
 * Validate a dashboard payload. Does not clip over-limit text — the API rejects it.
 * `musicFallback` keeps the headphones emoji set, which the editor does not edit.
 */
function validateTheme(input, musicFallback) {
    const errors = [];
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
        return { errors: ['Dữ liệu theme không hợp lệ.'], theme: null };
    }

    const name = textField(input.name);
    if (name == null) errors.push('Tên phải là chuỗi.');
    else if (!name) errors.push('Tên không được để trống.');
    else if ([...name].length > TEXT_LIMIT) errors.push('Tên tối đa 128 ký tự.');

    const clientId = textField(input.clientId);
    if (clientId == null || !/^[0-9]{17,19}$/.test(clientId)) {
        errors.push('Application ID phải là snowflake Discord (17–19 chữ số).');
    }

    const rotate = Number(input.rotateIntervalMs);
    if (!Number.isInteger(rotate) || rotate < MIN_ROTATE_MS || rotate > MAX_ROTATE_MS) {
        errors.push('Chu kỳ xoay phải từ 20 giây đến 60 phút.');
    }

    const largeImage = textField(input.largeImage);
    const smallImage = textField(input.smallImage);
    const largeText = textField(input.largeText);
    const smallText = textField(input.smallText);
    if (largeImage == null || !isAllowedImage(largeImage) || largeImage.length > 500) {
        errors.push('Ảnh lớn phải là URL http(s) hoặc mã mp:/youtube:/spotify:/twitch:.');
    }
    if (smallImage == null || !isAllowedImage(smallImage) || smallImage.length > 500) {
        errors.push('Ảnh nhỏ phải là URL http(s) hoặc mã mp:/youtube:/spotify:/twitch:.');
    }
    if (largeText == null || [...largeText].length > TEXT_LIMIT) errors.push('Hover ảnh lớn tối đa 128 ký tự.');
    if (smallText == null || [...smallText].length > TEXT_LIMIT) errors.push('Hover ảnh nhỏ tối đa 128 ký tự.');

    if (!Array.isArray(input.lines) || input.lines.length === 0) {
        errors.push('Cần ít nhất một câu.');
    } else if (input.lines.length > MAX_LINES) {
        errors.push(`Tối đa ${MAX_LINES} câu.`);
    }

    const lines = [];
    if (Array.isArray(input.lines)) {
        input.lines.forEach((line, index) => {
            const details = textField(line?.details);
            const state = textField(line?.state);
            const label = `Câu ${index + 1}`;
            if (details == null || state == null) {
                errors.push(`${label} không hợp lệ.`);
                return;
            }
            if (!details && !state) {
                errors.push(`${label} đang trống.`);
                return;
            }
            if ([...details].length > TEXT_LIMIT) errors.push(`Details của ${label} vượt 128 ký tự.`);
            if ([...state].length > TEXT_LIMIT) errors.push(`State của ${label} vượt 128 ký tự.`);
            lines.push({ details, state });
        });
    }

    if (!Array.isArray(input.buttons)) {
        errors.push('Danh sách nút không hợp lệ.');
    } else if (input.buttons.length > 2) {
        errors.push('Tối đa 2 nút.');
    }

    const buttons = [];
    if (Array.isArray(input.buttons)) {
        input.buttons.slice(0, 2).forEach((button, index) => {
            const label = textField(button?.label);
            const url = textField(button?.url);
            const name = `Nút ${index + 1}`;
            if (label == null || url == null) {
                errors.push(`${name} không hợp lệ.`);
                return;
            }
            if (!label && !url) return;
            if (!label || !url) {
                errors.push(`${name} cần cả nhãn và URL.`);
                return;
            }
            if ([...label].length > BUTTON_LIMIT) errors.push(`Nhãn ${name} tối đa 32 ký tự.`);
            if (!validHttp(url) || url.length > 512) errors.push(`URL ${name} phải là http hoặc https.`);
            buttons.push({ label, url });
        });
    }

    if (errors.length || !name || !clientId) {
        return { errors, theme: null };
    }

    return {
        errors: [],
        theme: {
            id: 'miku',
            clientId,
            name,
            rotateIntervalMs: rotate,
            largeImage: largeImage || '',
            largeText: largeText || '',
            smallImage: smallImage || '',
            smallText: smallText || '',
            lines,
            buttons,
            music: sanitizeMusic(input.music, musicFallback),
        },
    };
}

function publicTheme(theme) {
    return {
        name: theme.name,
        clientId: theme.clientId,
        rotateIntervalMs: theme.rotateIntervalMs,
        largeImage: theme.largeImage,
        largeText: theme.largeText,
        smallImage: theme.smallImage,
        smallText: theme.smallText,
        lines: theme.lines.map(line => ({ details: line.details, state: line.state })),
        buttons: theme.buttons.map(button => ({ label: button.label, url: button.url })),
    };
}

function writeThemeFile(theme) {
    const dir = path.dirname(THEME_FILE);
    fs.mkdirSync(dir, { recursive: true });
    const tmp = `${THEME_FILE}.tmp`;
    fs.writeFileSync(tmp, `${JSON.stringify(theme, null, 2)}\n`, 'utf8');
    fs.renameSync(tmp, THEME_FILE);
}

function initTheme() {
    const defaults = loadTheme();
    if (fs.existsSync(THEME_FILE)) {
        try {
            const parsed = JSON.parse(fs.readFileSync(THEME_FILE, 'utf8'));
            const result = validateTheme(parsed, defaults.music);
            if (result.errors.length) {
                throw new Error(result.errors.join(' '));
            }
            active = result.theme;
            customized = true;
            console.log(`🎧 Đã nạp theme đã lưu: Listening to ${active.name} · xoay mỗi ${Math.round(active.rotateIntervalMs / 1000)}s`);
            return active;
        } catch (err) {
            console.error('⚠️ data/theme.json không dùng được, quay về theme Miku:', err.message);
        }
    }
    active = defaults;
    customized = false;
    console.log(`🎧 Theme "${active.id}": Listening to ${active.name} · xoay mỗi ${Math.round(active.rotateIntervalMs / 1000)}s`);
    return active;
}

function getTheme() {
    if (!active) initTheme();
    return active;
}

function isCustomized() {
    return customized;
}

function getRevision() {
    return revision;
}

function saveTheme(input) {
    const current = getTheme();
    const result = validateTheme(input, current.music);
    if (result.errors.length) {
        const error = new Error(result.errors[0]);
        error.status = 400;
        error.errors = result.errors;
        throw error;
    }
    writeThemeFile(result.theme);
    active = result.theme;
    customized = true;
    revision += 1;
    return active;
}

function resetTheme() {
    if (fs.existsSync(THEME_FILE)) fs.unlinkSync(THEME_FILE);
    const tmp = `${THEME_FILE}.tmp`;
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    active = loadTheme();
    customized = false;
    revision += 1;
    console.log(`🎧 Đã đặt lại theme Miku: Listening to ${active.name}`);
    return active;
}

module.exports = {
    THEME_FILE,
    MIN_ROTATE_MS,
    MAX_ROTATE_MS,
    TEXT_LIMIT,
    BUTTON_LIMIT,
    initTheme,
    getTheme,
    isCustomized,
    getRevision,
    saveTheme,
    resetTheme,
    validateTheme,
    publicTheme,
    isAllowedImage,
};
