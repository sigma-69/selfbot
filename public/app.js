const $ = (id) => document.getElementById(id);

const boot = $('boot');
const loginView = $('login');
const loginForm = $('login-form');
const loginError = $('login-error');
const app = $('app');
const toast = $('toast');

let savedSignature = '';
let latest = null;
let pollTimer = null;
let clockTimer = null;
let readOnly = false;

function show(el) { el.hidden = false; }
function hide(el) { el.hidden = true; }

function toastMessage(text) {
    toast.textContent = text;
    show(toast);
    clearTimeout(toastMessage._timer);
    toastMessage._timer = setTimeout(() => hide(toast), 3200);
}

async function api(path, options = {}) {
    const response = await fetch(path, {
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
        ...options,
    });
    let body = null;
    const text = await response.text();
    if (text) {
        try { body = JSON.parse(text); } catch { body = { error: text }; }
    }
    if (response.status === 401 && path !== '/api/login') {
        stopLoops();
        showLogin();
        throw new Error('UNAUTHORIZED');
    }
    if (!response.ok) {
        const error = new Error(body?.message || body?.error || 'Yêu cầu thất bại.');
        error.body = body;
        error.status = response.status;
        throw error;
    }
    return body;
}

function stopLoops() {
    clearInterval(pollTimer);
    clearInterval(clockTimer);
    pollTimer = null;
    clockTimer = null;
}

function showLogin() {
    hide(boot);
    hide(app);
    show(loginView);
    loginError.textContent = '';
}

function setWriteEnabled(enabled) {
    document.querySelectorAll('[data-write]').forEach((node) => {
        node.disabled = !enabled;
    });
    document.querySelectorAll('#theme-form input, #theme-form textarea').forEach((node) => {
        node.disabled = !enabled;
    });
}

function countFor(id) {
    const input = $(id);
    const counter = document.querySelector(`[data-count-for="${id}"]`);
    if (!input || !counter) return;
    const max = Number(input.getAttribute('maxlength')) || 128;
    const length = [...input.value].length;
    counter.textContent = `${length}/${max}`;
    counter.classList.toggle('is-max', length >= max);
    counter.classList.toggle('is-hot', length >= max - 12 && length < max);
}

function bindCounters() {
    document.querySelectorAll('[data-count-for]').forEach((counter) => {
        const input = $(counter.dataset.countFor);
        if (!input || input.dataset.bound) return;
        input.dataset.bound = '1';
        input.addEventListener('input', () => countFor(input.id));
        countFor(input.id);
    });
}

function signatureOf(theme) {
    return JSON.stringify(normalizeTheme(theme));
}

function normalizeTheme(theme) {
    return {
        name: (theme.name || '').trim(),
        clientId: (theme.clientId || '').trim(),
        rotateIntervalMs: Number(theme.rotateIntervalMs),
        largeImage: (theme.largeImage || '').trim(),
        largeText: (theme.largeText || '').trim(),
        smallImage: (theme.smallImage || '').trim(),
        smallText: (theme.smallText || '').trim(),
        lines: (theme.lines || []).map((line) => ({
            details: (line.details || '').trim(),
            state: (line.state || '').trim(),
        })),
        buttons: (theme.buttons || [])
            .map((button) => ({ label: (button.label || '').trim(), url: (button.url || '').trim() }))
            .filter((button) => button.label || button.url),
    };
}

function readForm() {
    const lines = [...document.querySelectorAll('.line')].map((row) => ({
        details: row.querySelector('[data-field="details"]').value,
        state: row.querySelector('[data-field="state"]').value,
    }));
    const buttons = [];
    const first = { label: $('b1-label').value, url: $('b1-url').value };
    const second = { label: $('b2-label').value, url: $('b2-url').value };
    if (first.label.trim() || first.url.trim()) buttons.push(first);
    if (second.label.trim() || second.url.trim()) buttons.push(second);
    return normalizeTheme({
        name: $('name').value,
        clientId: $('clientId').value,
        rotateIntervalMs: Math.round(Number($('rotate').value) * 1000),
        largeImage: $('largeImage').value,
        largeText: $('largeText').value,
        smallImage: $('smallImage').value,
        smallText: $('smallText').value,
        lines,
        buttons,
    });
}

function isDirty() {
    if (!savedSignature) return false;
    return signatureOf(readForm()) !== savedSignature;
}

function fillButtons(buttons) {
    const slots = [buttons[0] || {}, buttons[1] || {}];
    $('b1-label').value = slots[0].label || '';
    $('b1-url').value = slots[0].url || '';
    $('b2-label').value = slots[1].label || '';
    $('b2-url').value = slots[1].url || '';
}

function renderLines(lines, activeIndex) {
    const host = $('lines');
    host.replaceChildren();
    lines.forEach((line, index) => {
        const article = document.createElement('article');
        article.className = `line${index === activeIndex ? ' is-active' : ''}`;

        const top = document.createElement('div');
        top.className = 'line-top';
        const title = document.createElement('p');
        title.className = 'line-title';
        title.textContent = index === activeIndex ? `Câu ${index + 1} · đang hiện` : `Câu ${index + 1}`;
        const tools = document.createElement('div');
        tools.className = 'line-tools';

        const up = toolButton('Lên', () => moveLine(index, -1));
        const down = toolButton('Xuống', () => moveLine(index, 1));
        const remove = toolButton('Xóa', () => removeLine(index));
        remove.classList.add('btn-danger');
        up.disabled = readOnly || index === 0;
        down.disabled = readOnly || index === lines.length - 1;
        remove.disabled = readOnly || lines.length === 1;
        tools.append(up, down, remove);
        top.append(title, tools);

        const pair = document.createElement('div');
        pair.className = 'pair';
        pair.append(
            field('Details', 'details', line.details || '', 128),
            field('State', 'state', line.state || '', 128),
        );
        article.append(top, pair);
        host.append(article);
    });
    host.querySelectorAll('textarea').forEach((node) => {
        node.disabled = readOnly;
        node.addEventListener('input', () => {
            const counter = node.parentElement.querySelector('.count');
            paintCount(counter, node.value, 128);
            refreshPreview();
        });
    });
}

function toolButton(label, onClick) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn-ghost btn-tiny';
    button.textContent = label;
    button.dataset.write = '';
    button.addEventListener('click', onClick);
    return button;
}

function field(label, name, value, max) {
    const wrap = document.createElement('label');
    wrap.append(document.createTextNode(label));
    const area = document.createElement('textarea');
    area.dataset.field = name;
    area.maxLength = max;
    area.value = value;
    const count = document.createElement('span');
    count.className = 'count';
    paintCount(count, value, max);
    wrap.append(area, count);
    return wrap;
}

function paintCount(counter, value, max) {
    const length = [...value].length;
    counter.textContent = `${length}/${max}`;
    counter.classList.toggle('is-max', length >= max);
    counter.classList.toggle('is-hot', length >= max - 12 && length < max);
}

function moveLine(index, delta) {
    const theme = readForm();
    const next = index + delta;
    if (next < 0 || next >= theme.lines.length) return;
    const [item] = theme.lines.splice(index, 1);
    theme.lines.splice(next, 0, item);
    renderLines(theme.lines, latest?.preview?.lineIndex ?? 0);
    refreshPreview();
}

function removeLine(index) {
    const theme = readForm();
    if (theme.lines.length === 1) return;
    theme.lines.splice(index, 1);
    renderLines(theme.lines, latest?.preview?.lineIndex ?? 0);
    refreshPreview();
}

function addLine() {
    const theme = readForm();
    if (theme.lines.length >= 24) {
        toastMessage('Tối đa 24 câu.');
        return;
    }
    theme.lines.push({ details: '', state: '' });
    renderLines(theme.lines, latest?.preview?.lineIndex ?? 0);
    const areas = $('lines').querySelectorAll('textarea');
    areas[areas.length - 2]?.focus();
}

function fillForm(theme, activeIndex) {
    $('name').value = theme.name || '';
    $('clientId').value = theme.clientId || '';
    $('rotate').value = Math.round((theme.rotateIntervalMs || 60000) / 1000);
    $('largeImage').value = theme.largeImage || '';
    $('largeText').value = theme.largeText || '';
    $('smallImage').value = theme.smallImage || '';
    $('smallText').value = theme.smallText || '';
    fillButtons(theme.buttons || []);
    renderLines(theme.lines || [], activeIndex || 0);
    bindCounters();
    ['name', 'largeText', 'smallText'].forEach(countFor);
    savedSignature = signatureOf(readForm());
}

function httpUrl(value) {
    try {
        const url = new URL(value);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
        return false;
    }
}

function setImage(img, fallback, url, hover) {
    img.alt = hover || '';
    img.title = hover || '';
    if (httpUrl(url)) {
        img.hidden = false;
        if (fallback) fallback.hidden = true;
        if (img.getAttribute('src') !== url) img.src = url;
        img.onerror = () => {
            img.hidden = true;
            if (fallback) fallback.hidden = false;
        };
        return;
    }
    img.hidden = true;
    img.removeAttribute('src');
    if (fallback) fallback.hidden = false;
}

function formatClock(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    const mm = String(minutes).padStart(2, '0');
    const ss = String(seconds).padStart(2, '0');
    if (hours > 0) return `${hours}:${mm}:${ss}`;
    return `${minutes}:${ss}`;
}

function draftPreview(preview) {
    if (!preview || !isDirty() || preview.mode !== 'idle') return preview;
    const form = readForm();
    const index = Math.min(preview.lineIndex || 0, Math.max(0, form.lines.length - 1));
    const line = form.lines[index] || { details: '', state: '' };
    return {
        ...preview,
        draft: true,
        name: form.name || preview.name,
        details: line.details,
        state: line.state,
        largeImage: form.largeImage,
        largeText: form.largeText,
        smallImage: form.smallImage,
        smallText: form.smallText,
        buttons: form.buttons,
        lineIndex: index,
    };
}

function renderPreview() {
    if (!latest) return;
    const preview = draftPreview(latest.preview);
    const card = $('preview');
    card.classList.toggle('is-paused', preview.mode === 'paused');
    $('preview-name').textContent = preview.mode === 'paused' ? 'Presence đang tắt' : (preview.name || 'Miku Nakano');
    $('preview-details').textContent = preview.mode === 'paused' ? 'Bấm Tiếp tục để hiện lại.' : (preview.details || '');
    $('preview-state').textContent = preview.mode === 'paused' ? '' : (preview.state || '');
    setImage($('preview-large'), $('preview-fallback'), preview.largeImage, preview.largeText);
    const small = $('preview-small');
    if (preview.smallImage && httpUrl(preview.smallImage) && preview.mode !== 'paused') {
        small.hidden = false;
        small.alt = preview.smallText || '';
        small.title = preview.smallText || '';
        if (small.getAttribute('src') !== preview.smallImage) small.src = preview.smallImage;
    } else {
        small.hidden = true;
        small.removeAttribute('src');
    }

    const flag = $('preview-flag');
    if (preview.draft) {
        flag.textContent = 'Bản nháp';
        flag.className = 'chip chip-music';
    } else if (preview.mode === 'music') {
        flag.textContent = 'Đang phát nhạc';
        flag.className = 'chip chip-music';
    } else if (preview.mode === 'paused') {
        flag.textContent = 'Tạm dừng';
        flag.className = 'chip chip-paused';
    } else {
        flag.textContent = 'Trên Discord';
        flag.className = 'chip chip-quiet';
    }

    const buttons = $('preview-buttons');
    buttons.replaceChildren();
    (preview.buttons || []).forEach((button) => {
        const node = httpUrl(button.url) ? document.createElement('a') : document.createElement('span');
        node.textContent = button.label || 'Nút';
        if (node.tagName === 'A') {
            node.href = button.url;
            node.target = '_blank';
            node.rel = 'noopener noreferrer';
        }
        buttons.append(node);
    });

    paintTime(preview);
}

function paintTime(preview) {
    const time = $('preview-time');
    const progress = $('preview-progress');
    const bar = $('preview-progress-bar');
    if (!preview || preview.mode === 'paused') {
        time.textContent = '';
        progress.hidden = true;
        return;
    }
    if (preview.mode === 'music' && preview.duration > 0) {
        const elapsedSec = Math.min(
            preview.duration,
            (preview.positionSec || 0) + (Date.now() - (preview.positionAt || Date.now())) / 1000,
        );
        time.textContent = `${formatClock(elapsedSec * 1000)} / ${formatClock(preview.duration * 1000)}`;
        progress.hidden = false;
        bar.style.width = `${Math.max(0, Math.min(100, (elapsedSec / preview.duration) * 100))}%`;
        return;
    }
    progress.hidden = true;
    const started = preview.startedAt || Date.now();
    time.textContent = `đã ${formatClock(Date.now() - started)}`;
}

function loginErrorText(code) {
    if (code === 'NO_TOKEN_CONFIGURED') return 'Chưa có DISCORD_TOKEN';
    return code || '';
}

function renderStatus(data) {
    const user = data.discord.userTag || 'Chưa đăng nhập';
    $('stat-user').textContent = user;
    $('stat-user-note').textContent = data.discord.tokenConfigured
        ? (data.discord.userId || '')
        : 'Thiếu DISCORD_TOKEN';
    $('stat-ws').textContent = data.discord.wsLabel;
    $('stat-ws-note').textContent = loginErrorText(data.discord.loginError);

    const modes = { idle: 'Theme Miku', music: 'Đang phát nhạc', paused: 'Tạm dừng' };
    $('stat-mode').textContent = modes[data.mode] || data.mode;
    $('stat-mode-note').textContent = data.paused
        ? 'Presence đã được gỡ khỏi Discord.'
        : (data.mode === 'idle' ? `Câu ${(data.preview.lineIndex || 0) + 1}` : 'Lời và ảnh bìa vẫn chạy.');

    if (data.track) {
        $('stat-track').textContent = `${data.track.title} — ${data.track.artist}`;
        $('stat-lyric').textContent = data.track.lyric || 'Chưa có dòng lời tại thời điểm này.';
    } else {
        $('stat-track').textContent = 'Không phát';
        $('stat-lyric').textContent = 'Lời sẽ hiện khi có dòng khớp thời gian.';
    }

    const chip = $('mode-chip');
    chip.textContent = modes[data.mode] || 'Idle';
    chip.className = data.mode === 'music' ? 'chip chip-music' : (data.mode === 'paused' ? 'chip chip-paused' : 'chip');

    const pause = $('pause');
    pause.textContent = data.paused ? 'Tiếp tục' : 'Tạm dừng';
    pause.dataset.action = data.paused ? 'resume' : 'pause';

    $('custom-chip').textContent = data.customized ? 'Đã lưu trên máy' : 'Mặc định Miku';
    $('readonly-banner').hidden = !data.readOnly;
}

function markActiveLine(index) {
    document.querySelectorAll('.line').forEach((row, i) => {
        row.classList.toggle('is-active', i === index);
        const title = row.querySelector('.line-title');
        if (title) title.textContent = i === index ? `Câu ${i + 1} · đang hiện` : `Câu ${i + 1}`;
    });
}

let seenRevision = null;

function applyState(data, refill) {
    latest = data;
    readOnly = Boolean(data.readOnly);
    renderStatus(data);
    const revisionChanged = data.revision !== seenRevision;
    if (refill || (revisionChanged && !isDirty())) {
        fillForm(data.theme, data.preview.lineIndex || 0);
        seenRevision = data.revision;
    } else if (data.preview.mode === 'idle') {
        markActiveLine(data.preview.lineIndex || 0);
    }
    setWriteEnabled(!readOnly);
    renderPreview();
}

function refreshPreview() {
    renderPreview();
}

async function refreshState(refill) {
    const data = await api('/api/state');
    applyState(data, refill);
}

function startLoops() {
    stopLoops();
    pollTimer = setInterval(() => {
        refreshState(false).catch(() => {});
    }, 2000);
    clockTimer = setInterval(() => {
        if (latest) paintTime(draftPreview(latest.preview));
    }, 1000);
}

function showErrors(errors) {
    const list = $('form-errors');
    list.replaceChildren();
    if (!errors || !errors.length) {
        list.hidden = true;
        return;
    }
    errors.forEach((message) => {
        const item = document.createElement('li');
        item.textContent = message;
        list.append(item);
    });
    list.hidden = false;
}

function localErrors(theme) {
    const errors = [];
    if (!theme.name) errors.push('Tên không được để trống.');
    if ([...theme.name].length > 128) errors.push('Tên tối đa 128 ký tự.');
    if (!/^[0-9]{17,19}$/.test(theme.clientId)) errors.push('Application ID phải là 17–19 chữ số.');
    if (!Number.isInteger(theme.rotateIntervalMs) || theme.rotateIntervalMs < 20000 || theme.rotateIntervalMs > 3600000) {
        errors.push('Chu kỳ xoay phải từ 20 giây đến 60 phút.');
    }
    if (!theme.lines.length) errors.push('Cần ít nhất một câu.');
    theme.lines.forEach((line, index) => {
        if (!line.details && !line.state) errors.push(`Câu ${index + 1} đang trống.`);
        if ([...line.details].length > 128 || [...line.state].length > 128) {
            errors.push(`Câu ${index + 1} vượt 128 ký tự.`);
        }
    });
    theme.buttons.forEach((button, index) => {
        if (!button.label || !button.url) errors.push(`Nút ${index + 1} cần cả nhãn và URL.`);
        if ([...button.label].length > 32) errors.push(`Nhãn nút ${index + 1} tối đa 32 ký tự.`);
        if (button.url && !httpUrl(button.url)) errors.push(`URL nút ${index + 1} phải là http hoặc https.`);
    });
    return errors;
}

async function saveTheme(event) {
    event.preventDefault();
    const theme = readForm();
    const errors = localErrors(theme);
    showErrors(errors);
    if (errors.length) return;
    $('save').disabled = true;
    try {
        await api('/api/theme', { method: 'PUT', body: JSON.stringify(theme) });
        await refreshState(true);
        toastMessage('Đã lưu và áp dụng presence.');
    } catch (err) {
        if (err.body?.errors) showErrors(err.body.errors);
        else toastMessage(err.message);
    } finally {
        setWriteEnabled(!readOnly);
    }
}

async function resetTheme() {
    if (!window.confirm('Xóa bản chỉnh trên bảng này và quay về theme Miku mặc định?')) return;
    try {
        await api('/api/theme/reset', { method: 'POST', body: '{}' });
        await refreshState(true);
        showErrors([]);
        toastMessage('Đã về theme Miku mặc định.');
    } catch (err) {
        toastMessage(err.message);
    }
}

async function runAction(path, done) {
    try {
        await api(path, { method: 'POST', body: '{}' });
        await refreshState(false);
        if (done) toastMessage(done);
    } catch (err) {
        toastMessage(err.message);
    }
}

async function bootApp() {
    const session = await api('/api/session');
    if (session.passwordRequired && !session.authenticated) {
        showLogin();
        return;
    }
    hide(boot);
    hide(loginView);
    show(app);
    $('logout').hidden = !session.authenticated;
    await refreshState(true);
    startLoops();
}

loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    loginError.textContent = '';
    $('login-submit').disabled = true;
    try {
        await api('/api/login', {
            method: 'POST',
            body: JSON.stringify({ password: $('password').value }),
        });
        $('password').value = '';
        await bootApp();
    } catch (err) {
        loginError.textContent = err.body?.error || 'Không đăng nhập được.';
    } finally {
        $('login-submit').disabled = false;
    }
});

$('logout').addEventListener('click', async () => {
    await api('/api/logout', { method: 'POST', body: '{}' });
    stopLoops();
    showLogin();
});

$('theme-form').addEventListener('submit', saveTheme);
$('theme-form').addEventListener('input', refreshPreview);
$('reset').addEventListener('click', resetTheme);
$('add-line').addEventListener('click', addLine);
$('pause').addEventListener('click', () => {
    const action = $('pause').dataset.action === 'resume' ? '/api/presence/resume' : '/api/presence/pause';
    runAction(action, action.endsWith('resume') ? 'Đã tiếp tục presence.' : 'Đã tạm dừng presence.');
});
$('refresh').addEventListener('click', () => runAction('/api/presence/refresh', 'Đã làm mới presence.'));
$('reconnect').addEventListener('click', () => runAction('/api/reconnect', 'Đã thử kết nối lại.'));
$('clear-music').addEventListener('click', () => runAction('/api/presence/clear-music', 'Đã xóa nhạc.'));

bindCounters();
bootApp().catch(() => {
    boot.textContent = 'Không mở được bảng điều khiển.';
});
