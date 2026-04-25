const API = '';
let pianoCanvas = null;
let pianoAudio = null;
let ws = null;
let currentMode = 'standalone';
let prevActiveNotes = new Set();
let currentSongName = null;

// Note names mapping
const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
function getMidiNoteName(midiNote) {
    const octave = Math.floor(midiNote / 12) - 1;
    const note = midiNote % 12;
    return noteNames[note] + octave;
}

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

        const isFavorite = localStorage.getItem(`fav-${song.name}`) === 'true';
        const favIcon = isFavorite ? '★' : '☆';

        item.innerHTML = `
            <span class="song-icon">&#9835;</span>
            <div class="song-info">
                <div class="song-name">${song.name}</div>
                <div class="song-meta">${(song.size / 1024).toFixed(1)} KB</div>
            </div>
            <div class="song-menu">
                <button class="menu-btn" title="Opciones">⋮</button>
                <div class="menu-dropdown">
                    <button class="menu-item fav-btn" data-song="${song.name}">${favIcon} Favorito</button>
                    <button class="menu-item delete-btn" data-song="${song.name}">🗑️ Eliminar</button>
                </div>
            </div>
        `;

        // Click en nombre → reproducir
        item.querySelector('.song-name').addEventListener('click', () => playSong(song.name));

        // Menu toggle
        const menuBtn = item.querySelector('.menu-btn');
        const menuDropdown = item.querySelector('.menu-dropdown');
        menuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            menuDropdown.classList.toggle('active');
        });

        // Cerrar menu al hacer click en otro lado
        document.addEventListener('click', () => {
            menuDropdown.classList.remove('active');
        });

        // Favorito
        item.querySelector('.fav-btn').addEventListener('click', async (e) => {
            e.stopPropagation();
            const isFav = localStorage.getItem(`fav-${song.name}`) === 'true';
            localStorage.setItem(`fav-${song.name}`, !isFav);
            loadSongs();
        });

        // Eliminar
        item.querySelector('.delete-btn').addEventListener('click', async (e) => {
            e.stopPropagation();
            if (confirm(`¿Eliminar "${song.name}"?`)) {
                await fetch(`${API}/api/songs/${encodeURIComponent(song.name)}`, { method: 'DELETE' });
                loadSongs();
            }
        });

        list.appendChild(item);
    }
}

// --- Player ---

async function playSong(name) {
    // Init audio on user gesture (required by browsers)
    if (!pianoAudio) pianoAudio = new PianoAudio();
    pianoAudio.init();

    currentSongName = name;
    document.getElementById('songTitle').textContent = name;
    showScreen('screen-player');
    prevActiveNotes = new Set();

    // Show play button and mark as paused
    document.getElementById('btnPlayCenter').style.display = 'flex';
    document.getElementById('btnPlayCenter').textContent = '▶';
    document.getElementById('btnPlayCenter').classList.remove('playing');

    // Render initial piano without notes
    if (pianoCanvas) {
        pianoCanvas.update({ active: [], upcoming: [], elapsed: 0 });
    }
}

function connectWebSocket() {
    if (ws) ws.close();

    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${location.host}/ws/player`;
    console.log('Connecting WebSocket to:', wsUrl);
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        console.log('WebSocket connected');
    };

    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            console.log('WebSocket message:', data.elapsed, 'active:', data.active.length, 'upcoming:', data.upcoming.length);
            if (pianoCanvas) {
                pianoCanvas.update(data);
            }

            // Show current note
            const noteDisplay = document.getElementById('noteDisplay');
            if (data.active && data.active.length > 0) {
                const highestNote = Math.max(...data.active.map(n => n.note));
                noteDisplay.textContent = getMidiNoteName(highestNote);
            } else {
                noteDisplay.textContent = '';
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
        } catch (error) {
            console.error('Error processing WebSocket message:', error);
        }
    };

    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
        console.log('WebSocket closed');
        if (pianoAudio) pianoAudio.stopAll();
        prevActiveNotes = new Set();
        if (document.getElementById('screen-player').classList.contains('active')) {
            console.log('Reconnecting WebSocket in 1s...');
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

document.getElementById('volumeSlider').addEventListener('input', (e) => {
    if (pianoAudio) pianoAudio.setVolume(parseInt(e.target.value) / 100);
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

// --- Play button center ---
document.getElementById('btnPlayCenter').addEventListener('click', async () => {
    const btn = document.getElementById('btnPlayCenter');
    if (btn.classList.contains('playing')) {
        // Pause/Stop playback
        btn.classList.remove('playing');
        if (pianoAudio) pianoAudio.stopAll();
        prevActiveNotes = new Set();
        await fetch(`${API}/api/player/stop`, { method: 'POST' });
        if (ws) ws.close();
        // Show button again
        btn.style.display = 'flex';
    } else {
        // Start playback
        if (currentSongName) {
            btn.classList.add('playing');
            // Hide button when playing
            btn.style.display = 'none';
            console.log('Starting playback for:', currentSongName);
            try {
                const response = await fetch(`${API}/api/player/play/${encodeURIComponent(currentSongName)}`, { method: 'POST' });
                if (!response.ok) {
                    throw new Error(`Server error: ${response.status}`);
                }
                const result = await response.json();
                console.log('Play response:', result);
                if (result.error) {
                    throw new Error(result.error);
                }
                connectWebSocket();
            } catch (error) {
                console.error('Play error:', error);
                alert(`Error al reproducir: ${error.message}`);
                btn.classList.remove('playing');
                btn.style.display = 'flex';
            }
        }
    }
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

// --- YouTube Extraction ---

let currentExtractJobId = null;
let extractCheckInterval = null;

document.getElementById('btnExtractYoutube').addEventListener('click', () => {
    document.getElementById('extractModal').classList.add('active');
    document.getElementById('youtubeUrl').focus();
});

document.getElementById('btnCloseExtract').addEventListener('click', () => {
    document.getElementById('extractModal').classList.remove('active');
    if (extractCheckInterval) clearInterval(extractCheckInterval);
});

document.getElementById('btnGetTitle').addEventListener('click', async () => {
    const url = document.getElementById('youtubeUrl').value.trim();
    if (!url) {
        alert('Por favor ingresa una URL de YouTube');
        return;
    }

    document.getElementById('btnGetTitle').disabled = true;
    document.getElementById('btnGetTitle').textContent = 'Obteniendo...';

    try {
        const res = await fetch(`${API}/api/songs-title`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });

        const data = await res.json();
        if (data.error) {
            alert(`Error: ${data.error}`);
        } else {
            document.getElementById('extractName').value = data.title;
        }
    } catch (error) {
        alert(`Error obteniendo título: ${error.message}`);
    } finally {
        document.getElementById('btnGetTitle').disabled = false;
        document.getElementById('btnGetTitle').textContent = 'Obtener título';
    }
});

document.getElementById('btnExtract').addEventListener('click', async () => {
    const url = document.getElementById('youtubeUrl').value.trim();
    const name = document.getElementById('extractName').value.trim();
    const separate = document.getElementById('extractSeparate').checked;

    if (!url) {
        alert('Por favor ingresa una URL de YouTube');
        return;
    }

    if (!name) {
        alert('Por favor ingresa el nombre de la canción o usa "Obtener título"');
        return;
    }

    // Hide input, show progress
    document.querySelector('.extract-section').style.display = 'none';
    document.getElementById('extractProgress').style.display = 'block';
    document.getElementById('extractResult').style.display = 'none';
    document.getElementById('btnExtract').disabled = true;

    try {
        const res = await fetch(`${API}/api/songs/extract-youtube`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, name, separate })
        });

        const data = await res.json();
        if (data.error) {
            throw new Error(data.error);
        }

        currentExtractJobId = data.job_id;
        pollExtractStatus();
    } catch (error) {
        showExtractResult('error', `Error: ${error.message}`);
        document.getElementById('btnExtract').disabled = false;
    }
});

function pollExtractStatus() {
    if (!currentExtractJobId) return;

    extractCheckInterval = setInterval(async () => {
        try {
            const res = await fetch(`${API}/api/songs/extract-status/${currentExtractJobId}`);
            const job = await res.json();

            document.getElementById('extractStatus').textContent = job.progress;

            if (job.status === 'done') {
                clearInterval(extractCheckInterval);
                showExtractResult('ok', `Extraccion completada: ${job.midi_path}`);
                document.getElementById('youtubeUrl').value = '';
                document.getElementById('extractName').value = '';
                await loadSongs();
                document.getElementById('btnExtract').disabled = false;
            } else if (job.status === 'error') {
                clearInterval(extractCheckInterval);
                showExtractResult('error', job.progress);
                document.getElementById('btnExtract').disabled = false;
            }
        } catch (error) {
            console.error('Error checking extraction status:', error);
        }
    }, 500);
}

function showExtractResult(type, message) {
    const resultEl = document.getElementById('extractResult');
    resultEl.className = `extract-result ${type}`;
    resultEl.textContent = message;
    resultEl.style.display = 'block';
}

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

// --- Keyboard Size Selector ---

document.getElementById('keyboardSize').addEventListener('change', (e) => {
    if (pianoCanvas) {
        pianoCanvas.setKeyboardSize(parseInt(e.target.value));
    }
});

// --- Search ---

function extractArtist(songName) {
    // Extrae el artista del nombre de la canción (parte antes del "-")
    const parts = songName.split(' - ');
    return parts.length > 1 ? parts[0].toLowerCase() : '';
}

function filterSongs() {
    const queryName = document.getElementById('search').value.toLowerCase();
    const queryArtist = document.getElementById('searchArtist').value.toLowerCase();

    document.querySelectorAll('.song-item').forEach(item => {
        const nameEl = item.querySelector('.song-name');
        if (!nameEl) return;

        const fullName = nameEl.textContent.toLowerCase();
        const artist = extractArtist(nameEl.textContent);

        // Mostrar solo si coincide con ambos filtros
        const matchesName = !queryName || fullName.includes(queryName);
        const matchesArtist = !queryArtist || artist.includes(queryArtist);

        item.style.display = (matchesName && matchesArtist) ? '' : 'none';
    });
}

document.getElementById('search').addEventListener('input', filterSongs);
document.getElementById('searchArtist').addEventListener('input', filterSongs);

// --- Init ---

document.addEventListener('DOMContentLoaded', () => {
    pianoCanvas = new PianoCanvas('pianoCanvas');
    loadSongs();
});
