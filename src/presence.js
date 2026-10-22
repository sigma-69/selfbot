const { RichPresence } = require('discord.js-selfbot-v13');
const { clip, idleLine } = require('../themes/load');
const state = require('./state');
const { getTheme } = require('./theme-store');
const { client } = require('./discord');
const { cleanTitle, cleanArtist, fetchLyrics, activeLyricAt } = require('./lyrics');
const {
    uploadToDiscordCDN,
    scheduleThemeImages,
    resolveThemeImages,
    invalidateThemeImages,
} = require('./images');

function musicIsLive(now = Date.now()) {
    return Boolean(
        state.currentTrack
        && !state.currentTrack.paused
        && (now - state.lastMusicUpdate < 7000)
    );
}

function applyImage(presence, slot, image, text) {
    if (!image) return;
    try {
        if (slot === 'large') {
            presence.setAssetsLargeImage(image);
            if (text) presence.setAssetsLargeText(clip(text));
        } else {
            presence.setAssetsSmallImage(image);
            if (text) presence.setAssetsSmallText(clip(text));
        }
    } catch (err) {
        console.error(`⚠️ Ảnh ${slot} bị thư viện từ chối: ${err.message}`);
    }
}

function applyButtons(presence, buttons) {
    for (const button of (buttons || []).slice(0, 2)) {
        if (!button || !button.label || !button.url) continue;
        try {
            presence.addButton(clip(button.label, 32), button.url);
        } catch (err) {
            console.error('⚠️ Nút presence bị bỏ:', err.message);
        }
    }
}

function livePlayback(now = Date.now()) {
    const track = state.currentTrack;
    if (!track) return null;
    const elapsedSincePing = (now - state.lastMusicUpdate) / 1000;
    const liveCurrentTime = Math.min(track.duration || 9999, (track.currentTime || 0) + elapsedSincePing);
    const lyric = activeLyricAt(state.currentLyrics, liveCurrentTime + 0.35);
    return {
        track,
        liveCurrentTime,
        duration: track.duration || 0,
        lyric,
        platform: track.platform || 'Music',
        songName: cleanTitle(track.title) || 'Unknown Song',
        artistName: cleanArtist(track.artist) || 'Artist',
    };
}

function artworkPreviewUrl(track) {
    if (!track) return '';
    if (typeof track.artwork === 'string' && /^https?:\/\//i.test(track.artwork)) return track.artwork;
    if (typeof track.videoId === 'string' && track.videoId.length >= 5) {
        return `https://i.ytimg.com/vi/${encodeURIComponent(track.videoId)}/hqdefault.jpg`;
    }
    if (typeof state.currentImageKey === 'string' && state.currentImageKey.startsWith('youtube:')) {
        const id = state.currentImageKey.slice('youtube:'.length);
        if (id) return `https://i.ytimg.com/vi/${encodeURIComponent(id)}/hqdefault.jpg`;
    }
    return '';
}

function describePresence(now = Date.now()) {
    const theme = getTheme();
    const base = {
        name: theme.name,
        largeText: theme.largeText,
        smallText: theme.smallText,
        smallImage: theme.smallImage,
        buttons: theme.buttons.map(button => ({ label: button.label, url: button.url })),
        startedAt: state.startTime,
        endsAt: null,
        lineIndex: 0,
        lyric: '',
        positionSec: null,
        positionAt: now,
        duration: null,
    };

    if (state.presencePaused) {
        return {
            ...base,
            mode: 'paused',
            details: '',
            state: '',
            largeImage: theme.largeImage,
            buttons: [],
        };
    }

    if (musicIsLive(now)) {
        const play = livePlayback(now);
        const music = theme.music;
        const endsAt = play.duration > 0
            ? now + (play.duration - play.liveCurrentTime) * 1000
            : null;
        const cover = artworkPreviewUrl(play.track) || theme.largeImage;
        return {
            ...base,
            mode: 'music',
            name: theme.name,
            details: clip(`${music.songEmoji} ${play.songName}`),
            state: clip(`${music.artistEmoji} ${play.artistName}`),
            largeImage: cover,
            largeText: clip(play.lyric ? `${music.lyricEmoji} ${play.lyric}` : `${music.platformEmoji} ${play.platform}`),
            lyric: play.lyric,
            startedAt: play.duration > 0 ? now - play.liveCurrentTime * 1000 : state.startTime,
            endsAt,
            positionSec: play.liveCurrentTime,
            duration: play.duration,
            buttons: musicButtons(play, theme),
        };
    }

    const line = idleLine(theme, now);
    return {
        ...base,
        mode: 'idle',
        details: clip(line.details),
        state: clip(line.state),
        largeImage: theme.largeImage,
        lineIndex: line.index,
    };
}

function musicButtons(play, theme) {
    const buttons = [];
    const track = play.track;
    if (track.url && (track.url.startsWith('http://') || track.url.startsWith('https://'))) {
        buttons.push({
            label: clip(`${theme.music.listenEmoji} Nghe trên ${play.platform}`, 32),
            url: track.url,
        });
    }
    for (const button of theme.buttons) {
        if (buttons.length >= 2) break;
        buttons.push({ label: button.label, url: button.url });
    }
    return buttons;
}

async function updatePresence(force = false) {
    if (!client.user) return;
    scheduleThemeImages();

    if (!musicIsLive() && state.currentTrack) {
        state.currentTrack = null;
        state.lastTrackId = '';
        state.currentLyrics = [];
        state.currentImageKey = null;
    }

    try {
        if (state.presencePaused) {
            if (!force && state.lastPresenceKey === 'PAUSED' && (Date.now() - state.lastSetActivityTime < 20000)) {
                return;
            }
            state.lastPresenceKey = 'PAUSED';
            state.lastSetActivityTime = Date.now();
            await client.user.setActivity();
            return;
        }

        const theme = getTheme();
        const view = describePresence();

        if (view.mode === 'music') {
            const play = livePlayback();
            const presenceKey = `MUSIC|${play.songName}|${view.state}|${state.currentImageKey}|${view.largeText}|${state.themeImages.large || ''}|${state.themeImages.small || ''}`;
            if (!force && presenceKey === state.lastPresenceKey && (Date.now() - state.lastSetActivityTime < 12000)) {
                return;
            }
            state.lastPresenceKey = presenceKey;
            state.lastSetActivityTime = Date.now();

            const presence = new RichPresence(client)
                .setApplicationId(theme.clientId)
                .setType('LISTENING')
                .setName(clip(theme.name))
                .setDetails(view.details)
                .setState(view.state);

            if (state.currentImageKey) {
                applyImage(presence, 'large', state.currentImageKey, view.largeText);
            } else if (state.themeImages.large) {
                applyImage(presence, 'large', state.themeImages.large, view.largeText);
            }
            applyImage(presence, 'small', state.themeImages.small, theme.smallText);

            if (play.duration > 0 && play.liveCurrentTime >= 0) {
                presence.setStartTimestamp(Math.floor(Date.now() - play.liveCurrentTime * 1000));
                presence.setEndTimestamp(Math.floor(Date.now() + (play.duration - play.liveCurrentTime) * 1000));
            }
            applyButtons(presence, view.buttons);
            await client.user.setActivity(presence);
            return;
        }

        const presenceKey = `IDLE|${view.lineIndex}|${view.details}|${view.state}|${state.themeImages.large || ''}|${state.themeImages.small || ''}`;
        if (!force && presenceKey === state.lastPresenceKey && (Date.now() - state.lastSetActivityTime < 20000)) {
            return;
        }
        state.lastPresenceKey = presenceKey;
        state.lastSetActivityTime = Date.now();

        const presence = new RichPresence(client)
            .setApplicationId(theme.clientId)
            .setType('LISTENING')
            .setName(clip(theme.name))
            .setDetails(view.details)
            .setState(view.state)
            .setStartTimestamp(state.startTime);

        applyImage(presence, 'large', state.themeImages.large, theme.largeText);
        applyImage(presence, 'small', state.themeImages.small, theme.smallText);
        applyButtons(presence, theme.buttons);
        await client.user.setActivity(presence);
    } catch (err) {
        console.error('❌ Lỗi updatePresence:', err.message);
    }
}

function clearMusic() {
    state.currentTrack = null;
    state.lastTrackId = '';
    state.currentLyrics = [];
    state.currentImageKey = null;
    return updatePresence(true);
}

async function handleTrackData(data) {
    require('./discord').ensureDiscordLogin();

    if (!data || !data.title || data.paused) {
        state.currentTrack = null;
        updatePresence(true);
        return { ok: true, reset: true };
    }

    state.lastMusicUpdate = Date.now();
    state.currentTrack = data;

    const trackId = `${cleanTitle(data.title)} - ${cleanArtist(data.artist)}`;
    if (trackId !== state.lastTrackId) {
        state.lastTrackId = trackId;
        state.lastPresenceKey = '';
        console.log(`\n🎵 BÀI HÁT: "${data.title}" (${cleanArtist(data.artist)}) trên ${data.platform || 'Web'}`);

        if (data.videoId && typeof data.videoId === 'string' && data.videoId.length >= 5) {
            state.currentImageKey = `youtube:${data.videoId}`;
        } else if (data.artwork && data.artwork.includes('scdn.co/image/')) {
            const spotId = data.artwork.split('scdn.co/image/')[1].split('?')[0];
            state.currentImageKey = `spotify:${spotId}`;
        } else if (data.artwork && data.artwork.includes('/vi/')) {
            const viMatch = data.artwork.match(/\/vi\/([^/]+)\//);
            if (viMatch) state.currentImageKey = `youtube:${viMatch[1]}`;
        } else if (data.url && (data.url.includes('v=') || data.url.includes('youtu.be/'))) {
            const matched = data.url.match(/[?&]v=([^&#]+)/) || data.url.match(/youtu\.be\/([^&#]+)/);
            if (matched) state.currentImageKey = `youtube:${matched[1]}`;
        } else {
            state.currentImageKey = null;
        }

        updatePresence(true);

        fetchLyrics(data.title, data.artist).then(lyrics => {
            state.currentLyrics = lyrics;
            updatePresence(true);
        });

        if (!state.currentImageKey && data.artwork && (data.artwork.startsWith('http://') || data.artwork.startsWith('https://'))) {
            uploadToDiscordCDN(data.artwork).then(cdnUrl => {
                if (cdnUrl && state.currentTrack && state.currentTrack.title === data.title) {
                    state.currentImageKey = cdnUrl;
                    updatePresence(true);
                }
            });
        }
    } else {
        updatePresence(false);
    }

    return { ok: true };
}

function setPaused(paused) {
    state.presencePaused = Boolean(paused);
    state.lastPresenceKey = '';
    return updatePresence(true);
}

async function applyThemeChange() {
    state.lastPresenceKey = '';
    try {
        await Promise.race([
            invalidateThemeImages(),
            new Promise(resolve => setTimeout(resolve, 8000)),
        ]);
    } catch (err) {
        console.error('⚠️ Không làm mới được ảnh theme:', err.message);
    }
    await updatePresence(true);
}

async function handleReady() {
    console.log('\n======================================================');
    console.log(`🎉 ĐÃ ĐĂNG NHẬP THÀNH CÔNG: ${client.user.tag}`);
    console.log('🤖 Đang kích hoạt chế độ Rich Presence 24/7 (LISTENING)...');
    console.log('======================================================\n');
    state.loginError = null;

    try {
        await require('./discord').initStorageChannel();
    } catch {
        /* đã log trong initStorageChannel */
    }

    try {
        await Promise.race([
            resolveThemeImages(),
            new Promise(resolve => setTimeout(resolve, 8000)),
        ]);
    } catch {
        /* ảnh sẽ được thử lại ở vòng update */
    }

    updatePresence(true);
    if (state.presenceInterval) clearInterval(state.presenceInterval);
    state.presenceInterval = setInterval(() => {
        updatePresence(false);
    }, 500);
}

module.exports = {
    describePresence,
    updatePresence,
    clearMusic,
    handleTrackData,
    setPaused,
    applyThemeChange,
    handleReady,
    musicIsLive,
    livePlayback,
};
