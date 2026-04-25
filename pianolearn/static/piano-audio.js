class PianoAudio {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.compressor = null;
        this.samples = {};       // note number -> AudioBuffer
        this.activeNotes = new Map(); // note -> {source, gain, panner, filter}
        this.started = false;
        this.loading = false;
        this.loaded = false;
        this._loadProgress = 0;
    }

    init() {
        if (this.started) return;
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();

        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.7;

        this.compressor = this.ctx.createDynamicsCompressor();
        this.compressor.threshold.value = -12;
        this.compressor.knee.value = 10;
        this.compressor.ratio.value = 4;
        this.compressor.attack.value = 0.002;
        this.compressor.release.value = 0.12;

        // Reverb send
        this.convolver = this.ctx.createConvolver();
        this.convolver.buffer = this._createReverb();
        this._reverbGain = this.ctx.createGain();
        this._reverbGain.gain.value = 0.07;

        // Dry -> compressor -> out
        this.masterGain.connect(this.compressor);
        // Wet -> reverb -> reverbGain -> compressor -> out
        this.masterGain.connect(this.convolver);
        this.convolver.connect(this._reverbGain);
        this._reverbGain.connect(this.compressor);
        this.compressor.connect(this.ctx.destination);

        this.started = true;
        if (!this.loaded && !this.loading) this._loadSamples();
    }

    _createReverb() {
        const rate = this.ctx.sampleRate;
        const duration = 2.2;
        const len = Math.floor(rate * duration);
        const buf = this.ctx.createBuffer(2, len, rate);

        for (let ch = 0; ch < 2; ch++) {
            const d = buf.getChannelData(ch);

            // Early reflections at specific delays (simulates room walls)
            const reflections = [0.012, 0.019, 0.027, 0.034, 0.048, 0.063, 0.079];
            for (const delay of reflections) {
                const idx = Math.floor(delay * rate);
                if (idx < len) {
                    const amp = 0.4 * (1 - delay / 0.08);
                    // Spread reflections across stereo
                    d[idx] += amp * (ch === 0 ? 0.8 : 0.6) * (Math.random() > 0.5 ? 1 : -1);
                    // Smear each reflection slightly
                    for (let j = -2; j <= 2; j++) {
                        if (idx + j >= 0 && idx + j < len) {
                            d[idx + j] += amp * 0.2 * (Math.random() * 2 - 1);
                        }
                    }
                }
            }

            // Diffuse tail starting after early reflections
            for (let i = Math.floor(0.04 * rate); i < len; i++) {
                const t = i / rate;
                // Exponential decay with frequency-dependent absorption
                const envelope = Math.exp(-t * 2.8) * 0.35;
                d[i] += (Math.random() * 2 - 1) * envelope;
            }
        }
        return buf;
    }

    async _loadSamples() {
        this.loading = true;

        // Load ALL 88 piano keys - no pitch shifting needed
        const noteLetters = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];
        const allNotes = [];

        // A0 (21) to C8 (108)
        // A0, Bb0, B0
        allNotes.push('A0', 'Bb0', 'B0');
        // C1-B7 (all 12 notes per octave)
        for (let oct = 1; oct <= 7; oct++) {
            for (const letter of noteLetters) {
                allNotes.push(letter + oct);
            }
        }
        // C8
        allNotes.push('C8');

        const baseUrl = 'https://gleitz.github.io/midi-js-soundfonts/FatBoy/acoustic_grand_piano-mp3/';

        const nameToMidi = (name) => {
            const notes = {'C':0,'Db':1,'D':2,'Eb':3,'E':4,'F':5,'Gb':6,'G':7,'Ab':8,'A':9,'Bb':10,'B':11};
            const notePart = name.slice(0, -1);
            const octave = parseInt(name.slice(-1));
            return notes[notePart] + (octave + 1) * 12;
        };

        // Load in batches of 12 to avoid overwhelming the browser
        let loaded = 0;
        const batchSize = 12;
        for (let i = 0; i < allNotes.length; i += batchSize) {
            const batch = allNotes.slice(i, i + batchSize);
            await Promise.all(batch.map(async (name) => {
                const midi = nameToMidi(name);
                try {
                    const res = await fetch(`${baseUrl}${name}.mp3`);
                    if (!res.ok) return;
                    const buf = await res.arrayBuffer();
                    this.samples[midi] = await this.ctx.decodeAudioData(buf);
                    loaded++;
                    this._loadProgress = loaded / allNotes.length;
                } catch (e) {
                    // Sample not available
                }
            }));
        }

        this.loaded = true;
        this.loading = false;
        this._loadProgress = 1;
    }

    _findClosestSample(note) {
        // With all 88 keys loaded, this should return exact match most of the time
        if (this.samples[note]) return note;
        let closest = null;
        let minDist = Infinity;
        for (const key in this.samples) {
            const dist = Math.abs(parseInt(key) - note);
            if (dist < minDist) {
                minDist = dist;
                closest = parseInt(key);
            }
        }
        return closest;
    }

    // Stereo pan: low notes left, high notes right
    _notePan(note) {
        return ((note - 21) / (108 - 21) - 0.5) * 0.7;
    }

    noteOn(note, velocity = 100) {
        if (!this.started) this.init();

        const now = this.ctx.currentTime;

        // Quick crossfade if same note is already playing
        if (this.activeNotes.has(note)) {
            const prev = this.activeNotes.get(note);
            prev.gain.gain.cancelScheduledValues(now);
            prev.gain.gain.setValueAtTime(prev.gain.gain.value, now);
            prev.gain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);
            try { prev.source.stop(now + 0.03); } catch(e) {}
            this.activeNotes.delete(note);
        }

        if (!this.loaded) {
            this._oscNoteOn(note, velocity);
            return;
        }

        const sampleNote = this._findClosestSample(note);
        if (sampleNote === null) return;

        const buffer = this.samples[sampleNote];
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;

        // Pitch shift only if exact sample isn't available (rare with full 88)
        const semitones = note - sampleNote;
        if (semitones !== 0) {
            source.playbackRate.value = Math.pow(2, semitones / 12);
        }

        // --- Velocity-dependent volume ---
        const velNorm = velocity / 127;
        const vol = velNorm * 0.75 + 0.05; // 0.05 - 0.80 range

        const gainNode = this.ctx.createGain();
        // Soft attack: faster for high velocity (percussive), slower for soft
        const attackTime = 0.003 + (1 - velNorm) * 0.010;
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(vol, now + attackTime);

        // --- Velocity-dependent brightness (low-pass filter) ---
        // Soft notes sound warmer (more muffled), loud notes brighter
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        // Soft (vel=0): 2kHz cutoff, Loud (vel=127): 16kHz (wide open)
        filter.frequency.value = 2000 + velNorm * 14000;
        filter.Q.value = 0.5;

        // Stereo panning
        const panner = this.ctx.createStereoPanner();
        panner.pan.value = this._notePan(note);

        // Chain: source -> filter -> gain -> panner -> master
        source.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(panner);
        panner.connect(this.masterGain);
        source.start();

        source.onended = () => {
            if (this.activeNotes.get(note)?.source === source) {
                this.activeNotes.delete(note);
            }
        };

        this.activeNotes.set(note, { source, gain: gainNode, panner, filter });
    }

    noteOff(note) {
        const entry = this.activeNotes.get(note);
        if (!entry) return;

        const now = this.ctx.currentTime;
        const currentVal = entry.gain.gain.value;
        if (currentVal <= 0.001) {
            try { entry.source.stop(now); } catch(e) {}
            this.activeNotes.delete(note);
            return;
        }

        // Piano damper: bass strings ring longer, treble shorter
        // Also close the filter during release for warmth
        const releaseTime = 0.12 + Math.max(0, (72 - note) / 60) * 0.30;

        entry.gain.gain.cancelScheduledValues(now);
        entry.gain.gain.setValueAtTime(currentVal, now);
        // Damper hits string: quick initial drop, then exponential tail
        entry.gain.gain.linearRampToValueAtTime(currentVal * 0.20, now + releaseTime * 0.12);
        entry.gain.gain.exponentialRampToValueAtTime(0.001, now + releaseTime);

        // Darken the sound during release (damper absorbs high frequencies)
        if (entry.filter) {
            entry.filter.frequency.cancelScheduledValues(now);
            entry.filter.frequency.setValueAtTime(entry.filter.frequency.value, now);
            entry.filter.frequency.exponentialRampToValueAtTime(800, now + releaseTime * 0.5);
        }

        try { entry.source.stop(now + releaseTime + 0.02); } catch(e) {}

        // Delayed cleanup so re-articulation during release still crossfades
        const src = entry.source;
        setTimeout(() => {
            if (this.activeNotes.get(note)?.source === src) {
                this.activeNotes.delete(note);
            }
        }, releaseTime * 1000 + 30);
    }

    // Oscillator fallback while samples load
    _oscNoteOn(note, velocity) {
        const freq = 440 * Math.pow(2, (note - 69) / 12);
        const vol = (velocity / 127) * 0.15;
        const now = this.ctx.currentTime;

        const osc = this.ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = freq;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(vol, now + 0.005);
        gain.gain.exponentialRampToValueAtTime(vol * 0.3, now + 0.3);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 2);

        const panner = this.ctx.createStereoPanner();
        panner.pan.value = this._notePan(note);

        osc.connect(gain);
        gain.connect(panner);
        panner.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 3);

        this.activeNotes.set(note, { source: osc, gain, panner, filter: null });
    }

    setVolume(vol) {
        if (this.masterGain) {
            this.masterGain.gain.value = Math.max(0, Math.min(1, vol * 1.4));
        }
    }

    stopAll() {
        const now = this.ctx ? this.ctx.currentTime : 0;
        for (const note of [...this.activeNotes.keys()]) {
            const entry = this.activeNotes.get(note);
            try {
                entry.gain.gain.cancelScheduledValues(now);
                entry.gain.gain.setValueAtTime(entry.gain.gain.value, now);
                entry.gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
                entry.source.stop(now + 0.05);
            } catch(e) {}
            this.activeNotes.delete(note);
        }
    }
}
