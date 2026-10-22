const crypto = require('crypto');

const sessions = new Set();
const loginFailures = new Map();
const COOKIE = 'miku_session';
const WINDOW_MS = 10 * 60 * 1000;
const MAX_FAILURES = 8;

function dashboardPassword() {
    const value = process.env.DASHBOARD_PASSWORD;
    if (typeof value !== 'string') return '';
    return value.trim();
}

function passwordConfigured() {
    return dashboardPassword().length > 0;
}

function warnIfNoPassword() {
    if (!passwordConfigured()) {
        console.warn('⚠️ Chưa đặt DASHBOARD_PASSWORD — bảng điều khiển chỉ xem, mọi thao tác ghi bị khóa.');
    }
}

function passwordsMatch(input, expected) {
    const a = crypto.createHash('sha256').update(String(input), 'utf8').digest();
    const b = crypto.createHash('sha256').update(String(expected), 'utf8').digest();
    return crypto.timingSafeEqual(a, b);
}

function parseCookies(req) {
    const header = req.headers.cookie || '';
    const out = {};
    for (const part of header.split(';')) {
        const text = part.trim();
        if (!text) continue;
        const eq = text.indexOf('=');
        const key = eq === -1 ? text : text.slice(0, eq);
        const value = eq === -1 ? '' : text.slice(eq + 1);
        out[key] = decodeURIComponent(value);
    }
    return out;
}

function isAuthed(req) {
    if (!passwordConfigured()) return false;
    const token = parseCookies(req)[COOKIE];
    return Boolean(token && sessions.has(token));
}

function clientIp(req) {
    return req.ip || req.socket?.remoteAddress || 'unknown';
}

function tooManyFailures(ip) {
    const now = Date.now();
    const recent = (loginFailures.get(ip) || []).filter(stamp => now - stamp < WINDOW_MS);
    loginFailures.set(ip, recent);
    return recent.length >= MAX_FAILURES;
}

function recordFailure(ip) {
    const now = Date.now();
    const recent = (loginFailures.get(ip) || []).filter(stamp => now - stamp < WINDOW_MS);
    recent.push(now);
    loginFailures.set(ip, recent);
}

function sessionCookie(req, token, maxAge) {
    const secure = req.secure || req.headers['x-forwarded-proto'] === 'https';
    const parts = [
        `${COOKIE}=${encodeURIComponent(token)}`,
        'HttpOnly',
        'SameSite=Lax',
        'Path=/',
        `Max-Age=${maxAge}`,
    ];
    if (secure) parts.push('Secure');
    return parts.join('; ');
}

function login(req, password) {
    if (!passwordConfigured()) {
        return { status: 400, body: { ok: false, error: 'Chưa cấu hình mật khẩu.' } };
    }
    const ip = clientIp(req);
    if (tooManyFailures(ip)) {
        return { status: 429, body: { ok: false, error: 'Thử lại sau vài phút.' } };
    }
    if (typeof password !== 'string' || password.length > 200 || !passwordsMatch(password, dashboardPassword())) {
        recordFailure(ip);
        return { status: 401, body: { ok: false, error: 'Mật khẩu không đúng.' } };
    }
    const token = crypto.randomBytes(32).toString('hex');
    sessions.add(token);
    return {
        status: 200,
        cookie: sessionCookie(req, token, 7 * 24 * 60 * 60),
        body: { ok: true },
    };
}

function logout(req) {
    const token = parseCookies(req)[COOKIE];
    if (token) sessions.delete(token);
    return sessionCookie(req, '', 0);
}

function sessionInfo(req) {
    const configured = passwordConfigured();
    const authenticated = configured && isAuthed(req);
    return {
        ok: true,
        passwordRequired: configured,
        authenticated,
        readOnly: !configured,
    };
}

function requireReader(req, res, next) {
    if (!passwordConfigured() || isAuthed(req)) return next();
    return res.status(401).json({ ok: false, error: 'UNAUTHORIZED' });
}

function requireWriter(req, res, next) {
    if (!passwordConfigured()) {
        return res.status(403).json({
            ok: false,
            error: 'READ_ONLY',
            message: 'Đặt DASHBOARD_PASSWORD để chỉnh theme và thao tác presence.',
        });
    }
    if (!isAuthed(req)) {
        return res.status(401).json({ ok: false, error: 'UNAUTHORIZED' });
    }
    return next();
}

module.exports = {
    warnIfNoPassword,
    passwordConfigured,
    isAuthed,
    login,
    logout,
    sessionInfo,
    requireReader,
    requireWriter,
};
