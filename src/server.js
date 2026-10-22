const path = require('path');
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const state = require('./state');
const { client, ensureDiscordLogin, reconnectDiscord, wsStatus } = require('./discord');
const {
    describePresence,
    updatePresence,
    clearMusic,
    handleTrackData,
    setPaused,
    applyThemeChange,
    musicIsLive,
    livePlayback,
} = require('./presence');
const {
    getTheme,
    publicTheme,
    saveTheme,
    resetTheme,
    isCustomized,
    getRevision,
} = require('./theme-store');
const {
    login,
    logout,
    sessionInfo,
    requireReader,
    requireWriter,
} = require('./auth');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const WS_LABELS = {
    '-1': 'Chưa khởi tạo',
    0: 'Đã kết nối',
    1: 'Đang kết nối',
    2: 'Đang kết nối lại',
    3: 'Chưa kết nối',
    4: 'Sắp xong',
    5: 'Mất kết nối',
    6: 'Đang chờ server',
    7: 'Đang xác thực',
    8: 'Đang tiếp tục',
};

function wsLabel(status) {
    return WS_LABELS[String(status)] || `Mã ${status}`;
}

function trackSummary() {
    if (!musicIsLive()) return null;
    const play = livePlayback();
    return {
        title: play.songName,
        artist: play.artistName,
        platform: play.platform,
        lyric: play.lyric,
        url: typeof play.track.url === 'string' ? play.track.url : '',
    };
}

function dashboardState() {
    const status = wsStatus();
    const preview = describePresence();
    return {
        ok: true,
        revision: getRevision(),
        customized: isCustomized(),
        readOnly: sessionInfo({ headers: {} }).readOnly,
        paused: state.presencePaused,
        discord: {
            ready: Boolean(client.user),
            userTag: client.user ? client.user.tag : null,
            username: client.user ? client.user.username : null,
            userId: client.user ? client.user.id : null,
            wsStatus: status,
            wsLabel: wsLabel(status),
            loginError: state.loginError,
            storageChannelReady: Boolean(state.storageChannel),
            tokenConfigured: Boolean(process.env.DISCORD_TOKEN),
        },
        mode: preview.mode,
        track: trackSummary(),
        preview,
        theme: publicTheme(getTheme()),
    };
}

function asyncRoute(handler) {
    return (req, res, next) => {
        Promise.resolve(handler(req, res, next)).catch(next);
    };
}

function startServer() {
    const app = express();
    const port = process.env.PORT || 3000;

    app.disable('x-powered-by');
    app.set('trust proxy', 1);
    app.use((req, res, next) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Referrer-Policy', 'no-referrer');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader(
            'Content-Security-Policy',
            [
                "default-src 'self'",
                "img-src 'self' https: data:",
                "style-src 'self' https://fonts.googleapis.com",
                "font-src 'self' https://fonts.gstatic.com data:",
                "script-src 'self'",
                "connect-src 'self'",
                "base-uri 'self'",
                "form-action 'self'",
            ].join('; ')
        );
        next();
    });
    app.use(cors());
    app.use(express.json({ limit: '64kb' }));

    app.get('/health', (req, res) => {
        ensureDiscordLogin();
        const theme = getTheme();
        res.type('text/plain').send(`✅ Discord 24/7 Music & Synced Lyrics Selfbot is RUNNING (theme: ${theme.id}).`);
    });

    app.get('/reconnect', asyncRoute(async (req, res) => {
        await ensureDiscordLogin();
        res.json({
            ok: Boolean(client.user),
            userTag: client.user ? client.user.tag : null,
            wsStatus: wsStatus(),
            loginError: state.loginError,
        });
    }));

    app.get('/bot-status', asyncRoute(async (req, res) => {
        const rawToken = process.env.DISCORD_TOKEN || '';
        const cleanToken = rawToken.trim().replace(/^['"]|['"]$/g, '');

        if (!client.user) ensureDiscordLogin();

        let discordApiCheck = null;
        if (cleanToken) {
            try {
                const apiRes = await axios.get('https://discord.com/api/v9/users/@me', {
                    headers: { Authorization: cleanToken },
                    timeout: 3000,
                });
                discordApiCheck = {
                    valid: true,
                    username: apiRes.data.username,
                    id: apiRes.data.id,
                };
            } catch (err) {
                discordApiCheck = {
                    valid: false,
                    status: err.response ? err.response.status : null,
                    error: err.response ? err.response.data : err.message,
                };
            }
        }

        res.json({
            server: 'online',
            discordReady: Boolean(client.user),
            userTag: client.user ? client.user.tag : null,
            userId: client.user ? client.user.id : null,
            status: client.user ? client.user.presence?.status : null,
            wsStatus: wsStatus(),
            activitiesCount: client.user ? (client.user.presence?.activities?.length || 0) : 0,
            activities: client.user ? client.user.presence?.activities : [],
            currentTrack: state.currentTrack,
            lastMusicUpdate: state.lastMusicUpdate ? new Date(state.lastMusicUpdate).toISOString() : null,
            storageChannelReady: Boolean(state.storageChannel),
            loginError: state.loginError,
            lastWsError: state.lastWsError,
            tokenConfigured: Boolean(rawToken),
            discordApiCheck,
        });
    }));

    app.post('/track', asyncRoute(async (req, res) => {
        res.json(await handleTrackData(req.body));
    }));

    app.get('/track', asyncRoute(async (req, res) => {
        const data = { ...req.query };
        data.currentTime = parseFloat(data.currentTime) || 0;
        data.duration = parseFloat(data.duration) || 0;
        data.paused = data.paused === 'true';
        res.json(await handleTrackData(data));
    }));

    const stop = (req, res) => {
        clearMusic();
        res.json({ ok: true });
    };
    app.post('/stop', stop);
    app.get('/stop', stop);

    app.get('/api/session', (req, res) => {
        res.setHeader('Cache-Control', 'no-store');
        res.json(sessionInfo(req));
    });

    app.post('/api/login', (req, res) => {
        const result = login(req, req.body?.password);
        if (result.cookie) res.setHeader('Set-Cookie', result.cookie);
        res.status(result.status).json(result.body);
    });

    app.post('/api/logout', (req, res) => {
        res.setHeader('Set-Cookie', logout(req));
        res.json({ ok: true });
    });

    app.get('/api/state', requireReader, (req, res) => {
        res.setHeader('Cache-Control', 'no-store');
        const body = dashboardState();
        body.readOnly = sessionInfo(req).readOnly;
        res.json(body);
    });

    app.put('/api/theme', requireWriter, asyncRoute(async (req, res) => {
        const theme = saveTheme(req.body);
        await applyThemeChange();
        res.json({
            ok: true,
            revision: getRevision(),
            customized: true,
            theme: publicTheme(theme),
            preview: describePresence(),
        });
    }));

    app.post('/api/theme/reset', requireWriter, asyncRoute(async (req, res) => {
        const theme = resetTheme();
        await applyThemeChange();
        res.json({
            ok: true,
            revision: getRevision(),
            customized: false,
            theme: publicTheme(theme),
            preview: describePresence(),
        });
    }));

    app.post('/api/presence/pause', requireWriter, asyncRoute(async (req, res) => {
        await setPaused(true);
        res.json({ ok: true, paused: true, preview: describePresence() });
    }));

    app.post('/api/presence/resume', requireWriter, asyncRoute(async (req, res) => {
        await setPaused(false);
        res.json({ ok: true, paused: false, preview: describePresence() });
    }));

    app.post('/api/presence/refresh', requireWriter, asyncRoute(async (req, res) => {
        state.lastPresenceKey = '';
        await updatePresence(true);
        res.json({ ok: true, preview: describePresence() });
    }));

    app.post('/api/presence/clear-music', requireWriter, asyncRoute(async (req, res) => {
        await clearMusic();
        res.json({ ok: true, preview: describePresence() });
    }));

    app.post('/api/reconnect', requireWriter, asyncRoute(async (req, res) => {
        const result = await reconnectDiscord();
        res.json(result);
    }));

    app.use(express.static(PUBLIC_DIR, {
        index: 'index.html',
        setHeaders(res, filePath) {
            if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
        },
    }));

    app.use((req, res) => {
        if (req.path.startsWith('/api/')) {
            res.status(404).json({ ok: false, error: 'NOT_FOUND' });
            return;
        }
        res.status(404).type('text/plain').send('Không tìm thấy trang.');
    });

    app.use((err, req, res, next) => {
        if (res.headersSent) return next(err);
        if (err.type === 'entity.parse.failed') {
            res.status(400).json({ ok: false, error: 'JSON không hợp lệ.' });
            return;
        }
        if (err.status === 400 && Array.isArray(err.errors)) {
            res.status(400).json({ ok: false, error: 'INVALID', errors: err.errors });
            return;
        }
        console.error('❌ Lỗi HTTP:', err.message);
        res.status(500).json({ ok: false, error: 'SERVER_ERROR' });
    });

    app.listen(port, '0.0.0.0', () => {
        console.log(`🌐 Bảng điều khiển đang lắng nghe tại http://0.0.0.0:${port}`);
    });

    return app;
}

module.exports = { startServer };
