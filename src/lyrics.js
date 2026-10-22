const axios = require('axios');

const cache = new Map();

function cleanArtist(artist) {
    if (!artist) return '';
    return artist
        .replace(/\s*-\s*Topic\s*/gi, '')
        .replace(/\s*-\s*Chủ đề\s*/gi, '')
        .replace(/VEVO$/gi, '')
        .replace(/Official$/gi, '')
        .trim();
}

function getPrimaryArtist(artist) {
    if (!artist) return '';
    const cleaned = cleanArtist(artist);
    return cleaned.split(/,| và | ft\. | feat\. | x | & /i)[0].trim();
}

function cleanTitle(title) {
    if (!title) return '';
    return title
        .replace(/\(Official.*?\)/gi, '')
        .replace(/\[Official.*?\]/gi, '')
        .replace(/\(Audio.*?\)/gi, '')
        .replace(/\[Audio.*?\]/gi, '')
        .replace(/\(Lyric.*?\)/gi, '')
        .replace(/\[Lyric.*?\]/gi, '')
        .replace(/\(MV.*?\)/gi, '')
        .replace(/\[MV.*?\]/gi, '')
        .replace(/\|.*$/g, '')
        .replace(/-.*MV$/gi, '')
        .replace(/\s*-\s*Topic\s*/gi, '')
        .trim();
}

function parseLRC(lrcText) {
    if (!lrcText) return [];
    const lines = lrcText.split('\n');
    const result = [];
    const timeRegex = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\]/g;

    for (const line of lines) {
        let match;
        const matches = [];
        while ((match = timeRegex.exec(line)) !== null) {
            const min = parseInt(match[1], 10);
            const sec = parseInt(match[2], 10);
            const ms = match[3] ? parseInt(match[3].padEnd(3, '0').slice(0, 3), 10) : 0;
            matches.push(min * 60 + sec + ms / 1000);
        }

        const text = line.replace(timeRegex, '').trim();
        if (text) {
            for (const timeSec of matches) {
                result.push({ timeSec, text });
            }
        }
    }

    result.sort((a, b) => a.timeSec - b.timeSec);
    return result;
}

async function fetchLyrics(title, artist) {
    const cleanedTitle = cleanTitle(title);
    const primaryArtist = getPrimaryArtist(artist);
    const cacheKey = `${cleanedTitle} - ${primaryArtist}`.toLowerCase();

    if (cache.has(cacheKey)) return cache.get(cacheKey);

    try {
        const res = await axios.get('https://lrclib.net/api/get', {
            params: {
                track_name: cleanedTitle,
                artist_name: primaryArtist || undefined,
            },
            timeout: 3000,
        });
        if (res.data && res.data.syncedLyrics) {
            const parsed = parseLRC(res.data.syncedLyrics);
            cache.set(cacheKey, parsed);
            return parsed;
        }
    } catch {
        /* thử search bên dưới */
    }

    try {
        const res = await axios.get('https://lrclib.net/api/search', {
            params: { q: `${cleanedTitle} ${primaryArtist}`.trim() },
            timeout: 3000,
        });
        if (res.data && res.data.length > 0) {
            for (const item of res.data) {
                if (item.syncedLyrics) {
                    const parsed = parseLRC(item.syncedLyrics);
                    cache.set(cacheKey, parsed);
                    return parsed;
                }
            }
        }
    } catch {
        /* không có lời */
    }

    cache.set(cacheKey, []);
    return [];
}

function activeLyricAt(lyrics, effectiveTime) {
    if (!lyrics || !lyrics.length) return '';
    for (let i = 0; i < lyrics.length; i++) {
        const line = lyrics[i];
        const nextLine = lyrics[i + 1];
        const lineEndTime = nextLine ? nextLine.timeSec : line.timeSec + 6;
        if (effectiveTime >= line.timeSec && effectiveTime < lineEndTime) {
            if (effectiveTime - line.timeSec <= 5.5) return line.text;
            return '';
        }
    }
    return '';
}

module.exports = {
    cleanArtist,
    cleanTitle,
    fetchLyrics,
    activeLyricAt,
};
