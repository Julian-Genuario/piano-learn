class ScoreCanvas {
    constructor(canvasId, containerId) {
        this.canvas = document.getElementById(canvasId);
        this.container = document.getElementById(containerId);
        this.ctx = this.canvas.getContext('2d');
        this.notes = [];
        this.duration = 0;

        // View transform
        this.panX = 0;
        this.panY = 0;
        this.zoom = 2.5; // start zoomed in so notes are big and readable

        // Layout: piano horizontal at bottom, time goes up
        this.pixelsPerSecond = 100;
        this.pianoHeight = 72;
        this.timeMarginLeft = 40;
        this.minNote = 21;
        this.maxNote = 108;
        this.colorRight = '#0064ff';
        this.colorLeft = '#00ff64';
        this.scrollMarker = null;

        // Key geometry
        this._keyX = {};
        this._keyW = {};
        this._whiteKeys = [];
        this._blackKeys = [];

        // Highlight state (for tap feedback)
        this._activeKeys = new Set();   // MIDI note numbers currently pressed
        this._activeNote = null;        // note event object currently tapped

        // Interaction
        this._dragging = false;
        this._dragStartX = 0;
        this._dragStartY = 0;
        this._panStartX = 0;
        this._panStartY = 0;
        this._pinchDist = 0;
        this._pinchZoom = 1;
        this._dragMoved = false;

        this._setupEvents();
        this._resize();
    }

    setNotes(notes, duration) {
        this.notes = notes;
        this.duration = duration;

        if (notes.length > 0) {
            this.minNote = Math.max(21, Math.min(...notes.map(n => n.note)) - 2);
            this.maxNote = Math.min(108, Math.max(...notes.map(n => n.note)) + 2);
        }

        this._computeKeyLayout();

        // Auto-fit: zoom so piano width fits the screen
        const pianoW = this._totalPianoWidthUnzoomed();
        const viewW = this._viewW() - this.timeMarginLeft;
        this.zoom = Math.max(1.5, viewW / pianoW);

        // Start at time 0 (bottom)
        this.panY = 0;
        this.panX = 0;

        // Center horizontally if piano is narrower than view
        const zoomedW = pianoW * this.zoom;
        if (zoomedW < viewW) {
            this.panX = -(viewW - zoomedW) / 2;
        }

        this.render();
    }

    setColors(right, left) {
        this.colorRight = right;
        this.colorLeft = left;
        this.render();
    }

    zoomIn() { this._zoomAt(this._viewW() / 2, this._viewH() / 2, 1.4); }
    zoomOut() { this._zoomAt(this._viewW() / 2, this._viewH() / 2, 1 / 1.4); }

    _viewW() { return this.canvas.width / (window.devicePixelRatio || 1); }
    _viewH() { return this.canvas.height / (window.devicePixelRatio || 1); }

    _isBlackKey(note) {
        return [1, 3, 6, 8, 10].includes(note % 12);
    }

    _noteName(note) {
        const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        return names[note % 12] + (Math.floor(note / 12) - 1);
    }

    _noteNameShort(note) {
        const names = ['Do', 'Do#', 'Re', 'Re#', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'La#', 'Si'];
        return names[note % 12];
    }

    _computeKeyLayout() {
        this._whiteKeys = [];
        this._blackKeys = [];
        this._keyX = {};
        this._keyW = {};

        const whites = [];
        for (let n = this.minNote; n <= this.maxNote; n++) {
            if (!this._isBlackKey(n)) whites.push(n);
        }

        const whiteW = 28;
        const blackW = 17;

        let x = 0;
        for (const wn of whites) {
            this._keyX[wn] = x;
            this._keyW[wn] = whiteW;
            this._whiteKeys.push(wn);
            x += whiteW;
        }

        for (let n = this.minNote; n <= this.maxNote; n++) {
            if (!this._isBlackKey(n)) continue;
            this._blackKeys.push(n);

            const prevWhite = n - 1;
            const nextWhite = n + 1;
            const px = this._keyX[prevWhite];
            const nx = this._keyX[nextWhite];

            if (px !== undefined && nx !== undefined) {
                this._keyX[n] = px + this._keyW[prevWhite] - blackW / 2;
            } else if (px !== undefined) {
                this._keyX[n] = px + this._keyW[prevWhite] - blackW / 2;
            } else if (nx !== undefined) {
                this._keyX[n] = nx - blackW / 2;
            }
            this._keyW[n] = blackW;
        }
    }

    _totalPianoWidthUnzoomed() {
        let maxX = 0;
        for (const n of this._whiteKeys) {
            maxX = Math.max(maxX, (this._keyX[n] || 0) + (this._keyW[n] || 0));
        }
        return maxX;
    }

    _zoomAt(cx, cy, factor) {
        const oldZoom = this.zoom;
        this.zoom = Math.max(0.5, Math.min(10, this.zoom * factor));
        const realFactor = this.zoom / oldZoom;

        const worldX = this.panX + (cx - this.timeMarginLeft);
        const gridBottom = this._viewH() - this.pianoHeight;
        const worldY = this.panY + (gridBottom - cy);
        this.panX = worldX * realFactor - (cx - this.timeMarginLeft);
        this.panY = worldY * realFactor - (gridBottom - cy);

        this._clampPan();
        this.render();
    }

    _clampPan() {
        const pps = this.pixelsPerSecond * this.zoom;
        const totalH = this.duration * pps + 100;
        const totalW = this._totalPianoWidthUnzoomed() * this.zoom + 60;
        const viewW = this._viewW() - this.timeMarginLeft;
        const viewH = this._viewH() - this.pianoHeight;

        this.panX = Math.max(-viewW * 0.4, Math.min(Math.max(0, totalW - viewW * 0.5), this.panX));
        this.panY = Math.max(-viewH * 0.3, Math.min(Math.max(0, totalH - viewH + 50), this.panY));
    }

    _setupEvents() {
        this._boundResize = () => { this._resize(); this.render(); };
        window.addEventListener('resize', this._boundResize);

        this.canvas.addEventListener('mousedown', (e) => {
            this._dragging = true;
            this._dragMoved = false;
            this._dragStartX = e.clientX;
            this._dragStartY = e.clientY;
            this._panStartX = this.panX;
            this._panStartY = this.panY;
            this.canvas.style.cursor = 'grabbing';
        });

        window.addEventListener('mousemove', (e) => {
            if (!this._dragging) return;
            const dx = e.clientX - this._dragStartX;
            const dy = e.clientY - this._dragStartY;
            if (Math.abs(dx) > 3 || Math.abs(dy) > 3) this._dragMoved = true;
            this.panX = this._panStartX - dx;
            this.panY = this._panStartY + dy;
            this._clampPan();
            this.render();
        });

        window.addEventListener('mouseup', () => {
            this._dragging = false;
            this.canvas.style.cursor = 'grab';
        });

        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const rect = this.canvas.getBoundingClientRect();
            const cx = e.clientX - rect.left;
            const cy = e.clientY - rect.top;

            if (e.ctrlKey) {
                const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
                this._zoomAt(cx, cy, factor);
            } else {
                if (e.shiftKey) {
                    this.panX += e.deltaY;
                } else {
                    this.panY -= e.deltaY;
                    this.panX += e.deltaX;
                }
                this._clampPan();
                this.render();
            }
        }, { passive: false });

        this.canvas.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                this._dragging = true;
                this._dragMoved = false;
                this._dragStartX = e.touches[0].clientX;
                this._dragStartY = e.touches[0].clientY;
                this._panStartX = this.panX;
                this._panStartY = this.panY;
            } else if (e.touches.length === 2) {
                this._dragging = false;
                this._pinchDist = this._touchDist(e.touches);
                this._pinchZoom = this.zoom;
            }
        }, { passive: true });

        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (e.touches.length === 1 && this._dragging) {
                const dx = e.touches[0].clientX - this._dragStartX;
                const dy = e.touches[0].clientY - this._dragStartY;
                if (Math.abs(dx) > 3 || Math.abs(dy) > 3) this._dragMoved = true;
                this.panX = this._panStartX - dx;
                this.panY = this._panStartY + dy;
                this._clampPan();
                this.render();
            } else if (e.touches.length === 2) {
                const dist = this._touchDist(e.touches);
                const factor = dist / this._pinchDist;
                this.zoom = Math.max(0.5, Math.min(10, this._pinchZoom * factor));
                this._clampPan();
                this.render();
            }
        }, { passive: false });

        this.canvas.addEventListener('touchend', () => { this._dragging = false; });
        this.canvas.style.cursor = 'grab';
    }

    _touchDist(touches) {
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    _resize() {
        const dpr = window.devicePixelRatio || 1;
        const w = this.container.clientWidth;
        const h = this.container.clientHeight;
        this.canvas.width = w * dpr;
        this.canvas.height = h * dpr;
        this.canvas.style.width = w + 'px';
        this.canvas.style.height = h + 'px';
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    render() {
        const ctx = this.ctx;
        const vw = this._viewW();
        const vh = this._viewH();
        const pps = this.pixelsPerSecond * this.zoom;
        const z = this.zoom;
        const tml = this.timeMarginLeft;
        const ph = this.pianoHeight;
        const gridBottom = vh - ph;

        ctx.fillStyle = '#0a0a12';
        ctx.fillRect(0, 0, vw, vh);

        // --- Note grid area (clipped) ---
        ctx.save();
        ctx.beginPath();
        ctx.rect(tml, 0, vw - tml, gridBottom);
        ctx.clip();

        // Column guides for white keys
        for (const wn of this._whiteKeys) {
            const kx = tml + this._keyX[wn] * z - this.panX;
            const kw = this._keyW[wn] * z;
            if (kx + kw < tml || kx > vw) continue;

            ctx.fillStyle = '#0c0c1a';
            ctx.fillRect(kx, 0, kw, gridBottom);

            ctx.strokeStyle = '#181835';
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(kx, 0);
            ctx.lineTo(kx, gridBottom);
            ctx.stroke();
        }

        // Darker columns for black keys
        for (const bn of this._blackKeys) {
            const kx = tml + this._keyX[bn] * z - this.panX;
            const kw = this._keyW[bn] * z;
            if (kx + kw < tml || kx > vw) continue;

            ctx.fillStyle = 'rgba(0,0,0,0.18)';
            ctx.fillRect(kx, 0, kw, gridBottom);
        }

        // Horizontal time lines
        const tStart = Math.max(0, this.panY / pps);
        const tEnd = (this.panY + gridBottom) / pps;
        const lineStep = z > 3 ? 0.25 : z > 1.5 ? 0.5 : z > 0.7 ? 1 : 2;

        for (let t = Math.floor(tStart / lineStep) * lineStep; t <= tEnd + lineStep; t += lineStep) {
            const sy = gridBottom - (t * pps - this.panY);
            if (sy < 0 || sy > gridBottom) continue;

            const isMajor = Math.abs(t % 1) < 0.01;
            ctx.strokeStyle = isMajor ? '#222244' : '#161630';
            ctx.lineWidth = isMajor ? 0.8 : 0.4;
            ctx.beginPath();
            ctx.moveTo(tml, sy);
            ctx.lineTo(vw, sy);
            ctx.stroke();
        }

        // Draw notes (white key notes first, then black key notes on top)
        const whiteNotes = [];
        const blackNotes = [];
        for (const n of this.notes) {
            if (n.note < this.minNote || n.note > this.maxNote) continue;
            if (this._keyX[n.note] === undefined) continue;
            if (this._isBlackKey(n.note)) {
                blackNotes.push(n);
            } else {
                whiteNotes.push(n);
            }
        }

        for (const batch of [whiteNotes, blackNotes]) {
            for (const n of batch) {
                const kx = tml + this._keyX[n.note] * z - this.panX;
                const kw = this._keyW[n.note] * z;
                const ny = gridBottom - ((n.start + n.duration) * pps - this.panY);
                const nh = Math.max(4, n.duration * pps);

                if (ny + nh < 0 || ny > gridBottom) continue;
                if (kx + kw < tml || kx > vw) continue;

                const color = n.hand === 'left' ? this.colorLeft : this.colorRight;
                const isActive = this._activeNote === n || this._activeKeys.has(n.note);
                const gap = Math.max(1, kw * 0.06);
                const rx = kx + gap;
                const rw = kw - gap * 2;
                const r = Math.min(5, rw / 2, nh / 2);

                // Glow (bigger when active)
                ctx.fillStyle = isActive ? '#fff' : color;
                ctx.globalAlpha = isActive ? 0.3 : 0.12;
                ctx.beginPath();
                ctx.roundRect(rx - (isActive ? 5 : 3), ny - (isActive ? 4 : 2), rw + (isActive ? 10 : 6), nh + (isActive ? 8 : 4), r + 2);
                ctx.fill();

                // Body
                ctx.fillStyle = color;
                ctx.globalAlpha = isActive ? 1.0 : 0.55 + (n.velocity / 127) * 0.45;
                ctx.beginPath();
                ctx.roundRect(rx, ny, rw, nh, r);
                ctx.fill();

                // White overlay when active
                if (isActive) {
                    ctx.fillStyle = '#fff';
                    ctx.globalAlpha = 0.3;
                    ctx.beginPath();
                    ctx.roundRect(rx, ny, rw, nh, r);
                    ctx.fill();
                }

                // Inner highlight stripe (left edge)
                ctx.globalAlpha = isActive ? 0.4 : 0.25;
                ctx.fillStyle = '#fff';
                const stripeW = Math.max(1.5, rw * 0.18);
                ctx.beginPath();
                ctx.roundRect(rx + 1, ny + 1, stripeW, nh - 2, Math.min(2, r));
                ctx.fill();

                // Border
                ctx.globalAlpha = isActive ? 1.0 : 0.6;
                ctx.strokeStyle = isActive ? '#fff' : color;
                ctx.lineWidth = isActive ? 2 : 1.2;
                ctx.beginPath();
                ctx.roundRect(rx, ny, rw, nh, r);
                ctx.stroke();

                // Note name label inside the note (if tall enough)
                if (nh > 16 && rw > 14) {
                    const name = this._noteName(n.note);
                    const fontSize = Math.min(11, rw * 0.42, nh * 0.45);
                    ctx.globalAlpha = 1.0;
                    ctx.fillStyle = '#fff';
                    ctx.font = `bold ${fontSize}px sans-serif`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(name, rx + rw / 2, ny + nh / 2);
                }

                ctx.globalAlpha = 1.0;
            }
        }

        // Playback marker (horizontal line)
        if (this.scrollMarker !== null) {
            const my = gridBottom - (this.scrollMarker * pps - this.panY);
            if (my >= 0 && my <= gridBottom) {
                ctx.strokeStyle = '#ff4444';
                ctx.lineWidth = 2.5;
                ctx.shadowColor = '#ff4444';
                ctx.shadowBlur = 10;
                ctx.beginPath();
                ctx.moveTo(tml, my);
                ctx.lineTo(vw, my);
                ctx.stroke();
                ctx.shadowBlur = 0;

                // Small triangle marker on the left
                ctx.fillStyle = '#ff4444';
                ctx.beginPath();
                ctx.moveTo(tml, my);
                ctx.lineTo(tml - 8, my - 5);
                ctx.lineTo(tml - 8, my + 5);
                ctx.closePath();
                ctx.fill();
            }
        }

        ctx.restore();

        // --- Time labels (fixed left) ---
        ctx.fillStyle = '#0e0e22';
        ctx.fillRect(0, 0, tml, gridBottom);
        ctx.strokeStyle = '#222';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(tml, 0);
        ctx.lineTo(tml, gridBottom);
        ctx.stroke();

        const labelStep = z > 2 ? 2 : z > 0.8 ? 5 : 10;
        for (let t = Math.floor(tStart / labelStep) * labelStep; t <= tEnd + labelStep; t += labelStep) {
            const sy = gridBottom - (t * pps - this.panY);
            if (sy < 4 || sy > gridBottom - 4) continue;

            ctx.fillStyle = '#777';
            ctx.font = '10px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const min = Math.floor(t / 60);
            const sec = Math.floor(t % 60);
            ctx.fillText(`${min}:${sec.toString().padStart(2, '0')}`, tml / 2, sy);

            ctx.strokeStyle = '#444';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(tml - 4, sy);
            ctx.lineTo(tml, sy);
            ctx.stroke();
        }

        // --- Piano keyboard (fixed bottom) ---
        ctx.fillStyle = '#10102a';
        ctx.fillRect(0, gridBottom, vw, ph);

        // Subtle gradient top edge
        const grad = ctx.createLinearGradient(0, gridBottom, 0, gridBottom + 6);
        grad.addColorStop(0, '#333');
        grad.addColorStop(1, '#10102a');
        ctx.fillStyle = grad;
        ctx.fillRect(0, gridBottom, vw, 6);

        // White keys
        for (const wn of this._whiteKeys) {
            const kx = tml + this._keyX[wn] * z - this.panX;
            const kw = this._keyW[wn] * z;
            if (kx + kw < 0 || kx > vw) continue;

            const pressed = this._activeKeys.has(wn);
            const kr = 3;

            if (pressed) {
                // Pressed: colored glow + lit key
                const hand = wn >= 60 ? 'right' : 'left';
                const hColor = hand === 'right' ? this.colorRight : this.colorLeft;

                // Glow behind key
                ctx.shadowColor = hColor;
                ctx.shadowBlur = 15;
                ctx.fillStyle = hColor;
                ctx.globalAlpha = 0.3;
                ctx.beginPath();
                ctx.roundRect(kx + 1, gridBottom + 3, kw - 2, ph - 5, [0, 0, kr, kr]);
                ctx.fill();
                ctx.shadowBlur = 0;

                // Key body lit
                ctx.globalAlpha = 1.0;
                const kg = ctx.createLinearGradient(0, gridBottom + 3, 0, gridBottom + ph - 3);
                kg.addColorStop(0, '#c0d8ff');
                kg.addColorStop(0.5, hColor);
                kg.addColorStop(1, '#8ab4f8');
                ctx.fillStyle = kg;
                ctx.beginPath();
                ctx.roundRect(kx + 1, gridBottom + 3, kw - 2, ph - 5, [0, 0, kr, kr]);
                ctx.fill();

                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.roundRect(kx + 1, gridBottom + 3, kw - 2, ph - 5, [0, 0, kr, kr]);
                ctx.stroke();
            } else {
                const kg = ctx.createLinearGradient(0, gridBottom + 3, 0, gridBottom + ph - 3);
                kg.addColorStop(0, '#e8e8f0');
                kg.addColorStop(0.85, '#ccccdd');
                kg.addColorStop(1, '#b8b8cc');
                ctx.fillStyle = kg;

                ctx.beginPath();
                ctx.roundRect(kx + 1, gridBottom + 3, kw - 2, ph - 5, [0, 0, kr, kr]);
                ctx.fill();

                ctx.strokeStyle = '#888';
                ctx.lineWidth = 0.5;
                ctx.beginPath();
                ctx.roundRect(kx + 1, gridBottom + 3, kw - 2, ph - 5, [0, 0, kr, kr]);
                ctx.stroke();
            }

            if (kw > 16) {
                const fontSize = Math.min(11, kw * 0.38);
                ctx.font = `${fontSize}px sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';
                ctx.fillStyle = pressed ? '#fff' : '#666';
                ctx.fillText(this._noteName(wn), kx + kw / 2, gridBottom + ph - 3);
            }
        }

        // Black keys
        for (const bn of this._blackKeys) {
            const kx = tml + this._keyX[bn] * z - this.panX;
            const kw = this._keyW[bn] * z;
            if (kx + kw < 0 || kx > vw) continue;

            const bh = ph * 0.58;
            const pressed = this._activeKeys.has(bn);
            const kr = 2;

            if (pressed) {
                const hand = bn >= 60 ? 'right' : 'left';
                const hColor = hand === 'right' ? this.colorRight : this.colorLeft;

                ctx.shadowColor = hColor;
                ctx.shadowBlur = 12;
                ctx.fillStyle = hColor;
                ctx.globalAlpha = 0.4;
                ctx.beginPath();
                ctx.roundRect(kx + 0.5, gridBottom + 3, kw - 1, bh, [0, 0, kr, kr]);
                ctx.fill();
                ctx.shadowBlur = 0;

                ctx.globalAlpha = 1.0;
                const bg = ctx.createLinearGradient(0, gridBottom + 3, 0, gridBottom + bh + 3);
                bg.addColorStop(0, '#7799cc');
                bg.addColorStop(0.5, hColor);
                bg.addColorStop(1, '#334466');
                ctx.fillStyle = bg;
                ctx.beginPath();
                ctx.roundRect(kx + 0.5, gridBottom + 3, kw - 1, bh, [0, 0, kr, kr]);
                ctx.fill();

                ctx.strokeStyle = '#aaccff';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.roundRect(kx + 0.5, gridBottom + 3, kw - 1, bh, [0, 0, kr, kr]);
                ctx.stroke();
            } else {
                const bg = ctx.createLinearGradient(0, gridBottom + 3, 0, gridBottom + bh + 3);
                bg.addColorStop(0, '#333');
                bg.addColorStop(0.7, '#1a1a1a');
                bg.addColorStop(1, '#111');
                ctx.fillStyle = bg;

                ctx.beginPath();
                ctx.roundRect(kx + 0.5, gridBottom + 3, kw - 1, bh, [0, 0, kr, kr]);
                ctx.fill();

                ctx.strokeStyle = '#000';
                ctx.lineWidth = 0.5;
                ctx.beginPath();
                ctx.roundRect(kx + 0.5, gridBottom + 3, kw - 1, bh, [0, 0, kr, kr]);
                ctx.stroke();

                ctx.fillStyle = 'rgba(255,255,255,0.08)';
                ctx.fillRect(kx + 2, gridBottom + 4, kw - 4, bh * 0.35);
            }

            if (kw > 12) {
                const fontSize = Math.min(8, kw * 0.38);
                ctx.fillStyle = pressed ? '#fff' : '#888';
                ctx.font = `${fontSize}px sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';
                ctx.fillText(this._noteName(bn), kx + kw / 2, gridBottom + bh);
            }
        }

        // Corner: zoom %
        ctx.fillStyle = '#0e0e22';
        ctx.fillRect(0, gridBottom, tml, ph);
        ctx.fillStyle = '#666';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${Math.round(this.zoom * 100)}%`, tml / 2, gridBottom + ph / 2);
    }

    setPlaybackPosition(time) {
        this.scrollMarker = time;

        const pps = this.pixelsPerSecond * this.zoom;
        const gridBottom = this._viewH() - this.pianoHeight;
        const markerScreenY = gridBottom - (time * pps - this.panY);

        // Smooth scroll: always lerp toward keeping the marker at 70% from bottom
        const targetPanY = time * pps - gridBottom * 0.7;
        const diff = targetPanY - this.panY;
        // Smooth follow: lerp factor depends on how far off we are
        if (Math.abs(diff) > 1) {
            this.panY += diff * 0.12;
        }
        this._clampPan();

        this.render();
    }

    timeAtY(clientY) {
        const rect = this.canvas.getBoundingClientRect();
        const sy = clientY - rect.top;
        const gridBottom = this._viewH() - this.pianoHeight;
        const pps = this.pixelsPerSecond * this.zoom;
        return Math.max(0, (this.panY + gridBottom - sy) / pps);
    }

    // Returns the note event at screen coordinates, or null
    noteAtPoint(clientX, clientY) {
        const rect = this.canvas.getBoundingClientRect();
        const sx = clientX - rect.left;
        const sy = clientY - rect.top;
        const gridBottom = this._viewH() - this.pianoHeight;
        const pps = this.pixelsPerSecond * this.zoom;
        const z = this.zoom;
        const tml = this.timeMarginLeft;

        if (sy >= gridBottom || sx < tml) return null;

        // Check black key notes first (they're on top visually)
        for (let i = this.notes.length - 1; i >= 0; i--) {
            const n = this.notes[i];
            if (n.note < this.minNote || n.note > this.maxNote) continue;
            if (this._keyX[n.note] === undefined) continue;

            const kx = tml + this._keyX[n.note] * z - this.panX;
            const kw = this._keyW[n.note] * z;
            const gap = Math.max(1, kw * 0.06);
            const rx = kx + gap;
            const rw = kw - gap * 2;
            const ny = gridBottom - ((n.start + n.duration) * pps - this.panY);
            const nh = Math.max(4, n.duration * pps);

            if (sx >= rx && sx <= rx + rw && sy >= ny && sy <= ny + nh) {
                return n;
            }
        }
        return null;
    }

    // Returns the MIDI note number for a piano key at screen coordinates, or null
    keyAtPoint(clientX, clientY) {
        const rect = this.canvas.getBoundingClientRect();
        const sx = clientX - rect.left;
        const sy = clientY - rect.top;
        const gridBottom = this._viewH() - this.pianoHeight;
        const z = this.zoom;
        const tml = this.timeMarginLeft;

        if (sy < gridBottom) return null;

        // Check black keys first (they overlap white keys)
        const bh = this.pianoHeight * 0.58;
        for (const bn of this._blackKeys) {
            const kx = tml + this._keyX[bn] * z - this.panX;
            const kw = this._keyW[bn] * z;
            if (sx >= kx && sx <= kx + kw && sy >= gridBottom + 3 && sy <= gridBottom + 3 + bh) {
                return bn;
            }
        }

        // Then white keys
        for (const wn of this._whiteKeys) {
            const kx = tml + this._keyX[wn] * z - this.panX;
            const kw = this._keyW[wn] * z;
            if (sx >= kx + 1 && sx <= kx + kw - 1 && sy >= gridBottom + 3) {
                return wn;
            }
        }

        return null;
    }

    destroy() {
        window.removeEventListener('resize', this._boundResize);
    }
}
