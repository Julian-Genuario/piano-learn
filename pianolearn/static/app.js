const API = '';
let pianoCanvas = null;
let pianoAudio = null;
let ws = null;
let currentMode = 'standalone';
let prevActiveNotes = new Set();

// --- Screen Management ---

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
    if (screenId === 'screen-player' && pianoCanvas) {
        pianoCanvas._resize();
    }
}

// --- Song List ---

async function loadSongs() {
    const res = await fetch(`${API}/api/songs`);
    const songs = await res.json();
    const list = document.getElementById('songList');
    list.innerHTML = '';

    if (songs.length === 0) {
        list.innerHTML = '<div class="empty-state"><div class="empty-icon">&#9835;</div><div class="empty-text">No hay canciones todavia.<br>Subi un MIDI para empezar.</div></div>';
        return;
    }

    for (const song of songs) {
        const item = document.createElement('div');
        item.className = 'song-item';
        item.innerHTML = `
            <span class="song-icon">&#9835;</span>
            <div>
                <div class="song-name">${song.name}</div>
                <div class="song-meta">${(song.size / 1024).toFixed(1)} KB</div>
            </div>
        `;
        item.addEventListener('click', () => playSong(song.name));
        list.appendChild(item);
    }
}

// --- Player ---

async function playSong(name) {
    // Init audio on user gesture (required by browsers)
    if (!pianoAudio) pianoAudio = new PianoAudio();
    pianoAudio.init();

    document.getElementById('songTitle').textContent = name;
    showScreen('screen-player');
    prevActiveNotes = new Set();
    await fetch(`${API}/api/player/play/${encodeURIComponent(name)}`, { method: 'POST' });
    connectWebSocket();
}

function connectWebSocket() {
    if (ws) ws.close();

    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${protocol}//${location.host}/ws/player`);

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (pianoCanvas) {
            pianoCanvas.update(data);
        }

        // Audio: detect new and released notes
        if (pianoAudio && pianoAudio.started) {
            const currentNotes = new Set();
            for (const n of (data.active || [])) {
                currentNotes.add(n.note);
                if (!prevActiveNotes.has(n.note)) {
                    pianoAudio.noteOn(n.note, n.velocity || 100);
                }
            }
            for (const note of prevActiveNotes) {
                if (!currentNotes.has(note)) {
                    pianoAudio.noteOff(note);
                }
            }
            prevActiveNotes = currentNotes;
        }
    };

    ws.onclose = () => {
        if (pianoAudio) pianoAudio.stopAll();
        prevActiveNotes = new Set();
        if (document.getElementById('screen-player').classList.contains('active')) {
            setTimeout(connectWebSocket, 1000);
        }
    };
}

// --- Upload ---

document.getElementById('uploadMidi').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    await fetch(`${API}/api/songs/upload`, { method: 'POST', body: formData });
    loadSongs();
    e.target.value = '';
});

// --- Controls ---

document.getElementById('btnBack').addEventListener('click', async () => {
    if (pianoAudio) pianoAudio.stopAll();
    prevActiveNotes = new Set();
    await fetch(`${API}/api/player/stop`, { method: 'POST' });
    if (ws) ws.close();
    showScreen('screen-library');
    loadSongs();
});

document.getElementById('btnPause').addEventListener('click', async () => {
    if (pianoAudio) pianoAudio.stopAll();
    prevActiveNotes = new Set();
    await fetch(`${API}/api/player/pause`, { method: 'POST' });
});

document.getElementById('btnStop').addEventListener('click', async () => {
    if (pianoAudio) pianoAudio.stopAll();
    prevActiveNotes = new Set();
    await fetch(`${API}/api/player/stop`, { method: 'POST' });
});

document.getElementById('playMode').addEventListener('change', async (e) => {
    await fetch(`${API}/api/player/mode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: e.target.value })
    });
});

document.getElementById('speedSlider').addEventListener('input', async (e) => {
    const speed = parseInt(e.target.value) / 100;
    document.getElementById('speedValue').textContent = e.target.value + '%';
    await fetch(`${API}/api/player/speed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ speed })
    });
});

// --- Mode Selector ---

document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentMode = btn.dataset.mode;

        if (currentMode === 'freeplay') {
            if (!pianoAudio) pianoAudio = new PianoAudio();
            pianoAudio.init();
            document.getElementById('songTitle').textContent = 'Free Play';
            showScreen('screen-player');
            connectWebSocket();
        }
    });
});

// --- Settings ---

document.getElementById('btnSettings').addEventListener('click', () => {
    document.getElementById('settingsModal').classList.add('active');
});

document.getElementById('btnCloseSettings').addEventListener('click', () => {
    document.getElementById('settingsModal').classList.remove('active');
});

document.getElementById('brightnessSlider').addEventListener('input', async (e) => {
    await fetch(`${API}/api/leds/brightness`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brightness: parseInt(e.target.value) })
    });
});

function hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return [r, g, b];
}

async function updateColors() {
    const right = hexToRgb(document.getElementById('colorRight').value);
    const left = hexToRgb(document.getElementById('colorLeft').value);

    if (pianoCanvas) {
        pianoCanvas.setColors(
            document.getElementById('colorRight').value,
            document.getElementById('colorLeft').value
        );
    }

    await fetch(`${API}/api/leds/colors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ right, left })
    });
}

document.getElementById('colorRight').addEventListener('input', updateColors);
document.getElementById('colorLeft').addEventListener('input', updateColors);

// --- Search ---

document.getElementById('search').addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    document.querySelectorAll('.song-item').forEach(item => {
        const name = item.querySelector('.song-name');
        if (name) {
            item.style.display = name.textContent.toLowerCase().includes(query) ? '' : 'none';
        }
    });
});

// --- Init ---

document.addEventListener('DOMContentLoaded', () => {
    pianoCanvas = new PianoCanvas('pianoCanvas');
    loadSongs();
});
