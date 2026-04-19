class PianoAudio {
    constructor() {
        this.ctx = null;
        this.activeOscs = new Map();
        this.masterGain = null;
        this.convolver = null;
        this.started = false;
    }

    init() {
        if (this.started) return;
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();

        // Master volume
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.5;

        // Reverb (convolver with generated impulse)
        this.convolver = this.ctx.createConvolver();
        this.convolver.buffer = this._createReverbImpulse(2.0, 2.5);
        const reverbGain = this.ctx.createGain();
        reverbGain.gain.value = 0.15;

        // Compressor
        this.compressor = this.ctx.createDynamicsCompressor();
        this.compressor.threshold.value = -18;
        this.compressor.knee.value = 12;
        this.compressor.ratio.value = 4;

        // Routing: master -> compressor -> destination
        //          master -> reverb -> reverbGain -> compressor
        this.masterGain.connect(this.compressor);
        this.masterGain.connect(this.convolver);
        this.convolver.connect(reverbGain);
        reverbGain.connect(this.compressor);
        this.compressor.connect(this.ctx.destination);

        this.started = true;
    }

    _createReverbImpulse(duration, decay) {
        const rate = this.ctx.sampleRate;
        const length = rate * duration;
        const impulse = this.ctx.createBuffer(2, length, rate);
        for (let ch = 0; ch < 2; ch++) {
            const data = impulse.getChannelData(ch);
            for (let i = 0; i < length; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
            }
        }
        return impulse;
    }

    _midiToFreq(note) {
        return 440 * Math.pow(2, (note - 69) / 12);
    }

    noteOn(note, velocity = 100) {
        if (!this.started) this.init();
        if (this.activeOscs.has(note)) this.noteOff(note);

        const freq = this._midiToFreq(note);
        const vol = (velocity / 127) * 0.28;
        const now = this.ctx.currentTime;

        // Brightness varies by register: high notes are brighter, low notes warmer
        const register = (note - 21) / 87; // 0=low, 1=high

        // Main gain envelope - piano hammer strike
        const gainNode = this.ctx.createGain();
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(vol, now + 0.005);          // very fast hammer attack
        gainNode.gain.exponentialRampToValueAtTime(vol * 0.7, now + 0.08); // initial drop
        gainNode.gain.exponentialRampToValueAtTime(vol * 0.4, now + 0.4);  // decay
        gainNode.gain.exponentialRampToValueAtTime(vol * 0.15, now + 1.5); // sustain fade
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 4.0);      // tail
        gainNode.connect(this.masterGain);

        const oscs = [];

        // 1) Fundamental - triangle for warmth
        const osc1 = this.ctx.createOscillator();
        osc1.type = 'triangle';
        osc1.frequency.value = freq;
        const g1 = this.ctx.createGain();
        g1.gain.value = 1.0;
        osc1.connect(g1);
        g1.connect(gainNode);
        oscs.push(osc1);

        // 2) 2nd harmonic - adds body
        const osc2 = this.ctx.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.value = freq * 2;
        const g2 = this.ctx.createGain();
        g2.gain.value = 0.4 * (1 - register * 0.3);
        // 2nd harmonic decays faster
        g2.gain.setValueAtTime(g2.gain.value, now);
        g2.gain.exponentialRampToValueAtTime(0.001, now + 2.0);
        osc2.connect(g2);
        g2.connect(gainNode);
        oscs.push(osc2);

        // 3) 3rd harmonic - brightness
        const osc3 = this.ctx.createOscillator();
        osc3.type = 'sine';
        osc3.frequency.value = freq * 3;
        const g3 = this.ctx.createGain();
        g3.gain.value = 0.15 * (0.5 + register * 0.5);
        g3.gain.setValueAtTime(g3.gain.value, now);
        g3.gain.exponentialRampToValueAtTime(0.001, now + 1.0);
        osc3.connect(g3);
        g3.connect(gainNode);
        oscs.push(osc3);

        // 4) 4th harmonic - shimmer, very subtle
        const osc4 = this.ctx.createOscillator();
        osc4.type = 'sine';
        osc4.frequency.value = freq * 4;
        const g4 = this.ctx.createGain();
        g4.gain.value = 0.06 * register;
        g4.gain.setValueAtTime(g4.gain.value, now);
        g4.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        osc4.connect(g4);
        g4.connect(gainNode);
        oscs.push(osc4);

        // 5) Hammer noise - percussive click on attack
        const noiseLen = 0.04;
        const noiseBuffer = this.ctx.createBuffer(1, this.ctx.sampleRate * noiseLen, this.ctx.sampleRate);
        const noiseData = noiseBuffer.getChannelData(0);
        for (let i = 0; i < noiseData.length; i++) {
            noiseData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / noiseData.length, 3);
        }
        const noiseSrc = this.ctx.createBufferSource();
        noiseSrc.buffer = noiseBuffer;

        // Bandpass filter the noise around the note frequency
        const noiseFilt = this.ctx.createBiquadFilter();
        noiseFilt.type = 'bandpass';
        noiseFilt.frequency.value = freq * 2;
        noiseFilt.Q.value = 2;

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.value = 0.3 * (0.3 + register * 0.7);

        noiseSrc.connect(noiseFilt);
        noiseFilt.connect(noiseGain);
        noiseGain.connect(gainNode);
        noiseSrc.start(now);

        // 6) Slight detuning for richness (like real piano strings)
        const osc1b = this.ctx.createOscillator();
        osc1b.type = 'triangle';
        osc1b.frequency.value = freq * 1.001; // ~2 cents sharp
        const g1b = this.ctx.createGain();
        g1b.gain.value = 0.3;
        osc1b.connect(g1b);
        g1b.connect(gainNode);
        oscs.push(osc1b);

        // Start all oscillators
        oscs.forEach(o => o.start(now));

        // Auto-stop after 5 seconds if not released
        const stopTime = now + 5;
        oscs.forEach(o => o.stop(stopTime));

        this.activeOscs.set(note, { oscs, gain: gainNode, noiseSrc });
    }

    noteOff(note) {
        const entry = this.activeOscs.get(note);
        if (!entry) return;

        const now = this.ctx.currentTime;

        // Damper release - piano string dampened
        entry.gain.gain.cancelScheduledValues(now);
        entry.gain.gain.setValueAtTime(entry.gain.gain.value, now);
        entry.gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

        entry.oscs.forEach(osc => {
            try { osc.stop(now + 0.2); } catch(e) {}
        });
        this.activeOscs.delete(note);
    }

    setVolume(vol) {
        if (this.masterGain) {
            this.masterGain.gain.value = Math.max(0, Math.min(1, vol));
        }
    }

    stopAll() {
        for (const note of [...this.activeOscs.keys()]) {
            this.noteOff(note);
        }
    }
}
