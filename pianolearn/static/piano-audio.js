class PianoAudio {
    constructor() {
        this.ctx = null;
        this.activeOscs = new Map(); // note -> {osc, gain}
        this.masterGain = null;
        this.started = false;
    }

    init() {
        if (this.started) return;
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();

        // Master volume
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.5;

        // Compressor to avoid clipping with many notes
        this.compressor = this.ctx.createDynamicsCompressor();
        this.compressor.threshold.value = -20;
        this.compressor.knee.value = 10;
        this.compressor.ratio.value = 4;

        this.masterGain.connect(this.compressor);
        this.compressor.connect(this.ctx.destination);
        this.started = true;
    }

    _midiToFreq(note) {
        return 440 * Math.pow(2, (note - 69) / 12);
    }

    noteOn(note, velocity = 100) {
        if (!this.started) this.init();
        if (this.activeOscs.has(note)) return; // already playing

        const freq = this._midiToFreq(note);
        const vol = (velocity / 127) * 0.35;
        const now = this.ctx.currentTime;

        // Piano-like sound: fundamental + harmonics with fast attack, medium decay
        const gainNode = this.ctx.createGain();
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(vol, now + 0.01); // fast attack
        gainNode.gain.exponentialRampToValueAtTime(vol * 0.6, now + 0.1); // initial decay
        gainNode.gain.exponentialRampToValueAtTime(vol * 0.3, now + 0.5); // sustain decay
        gainNode.connect(this.masterGain);

        // Fundamental
        const osc1 = this.ctx.createOscillator();
        osc1.type = 'triangle';
        osc1.frequency.value = freq;

        // 2nd harmonic (softer)
        const gain2 = this.ctx.createGain();
        gain2.gain.value = 0.3;
        const osc2 = this.ctx.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.value = freq * 2;

        // 3rd harmonic (very soft)
        const gain3 = this.ctx.createGain();
        gain3.gain.value = 0.1;
        const osc3 = this.ctx.createOscillator();
        osc3.type = 'sine';
        osc3.frequency.value = freq * 3;

        osc1.connect(gainNode);
        osc2.connect(gain2);
        gain2.connect(gainNode);
        osc3.connect(gain3);
        gain3.connect(gainNode);

        osc1.start(now);
        osc2.start(now);
        osc3.start(now);

        this.activeOscs.set(note, { oscs: [osc1, osc2, osc3], gain: gainNode });
    }

    noteOff(note) {
        const entry = this.activeOscs.get(note);
        if (!entry) return;

        const now = this.ctx.currentTime;
        entry.gain.gain.cancelScheduledValues(now);
        entry.gain.gain.setValueAtTime(entry.gain.gain.value, now);
        entry.gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3); // release

        // Stop oscillators after release
        entry.oscs.forEach(osc => osc.stop(now + 0.35));
        this.activeOscs.delete(note);
    }

    setVolume(vol) {
        if (this.masterGain) {
            this.masterGain.gain.value = Math.max(0, Math.min(1, vol));
        }
    }

    stopAll() {
        for (const note of this.activeOscs.keys()) {
            this.noteOff(note);
        }
    }
}
