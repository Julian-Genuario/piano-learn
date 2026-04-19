class PianoCanvas {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');

        this.firstNote = 36;
        this.lastNote = 96;
        this.totalKeys = this.lastNote - this.firstNote;

        this.colors = {
            right: '#2196F3',
            left: '#4CAF50',
            wrong: '#f44336',
            whiteKey: '#e8e8e8',
            whiteKeyPressed: '#cccccc',
            blackKey: '#1a1a1a',
            blackKeyPressed: '#333333',
            keyBorder: '#999',
            background: '#0d0d0d',
            guideLine: 'rgba(255,255,255,0.03)'
        };

        this.keyboardHeight = 90;
        this.activeNotes = [];
        this.upcomingNotes = [];
        this.elapsed = 0;
        this.window = 3.0;

        this._resize();
        window.addEventListener('resize', () => this._resize());
    }

    _resize() {
        this.canvas.width = this.canvas.clientWidth * window.devicePixelRatio;
        this.canvas.height = this.canvas.clientHeight * window.devicePixelRatio;
        this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        this.width = this.canvas.clientWidth;
        this.height = this.canvas.clientHeight;
        this.keyboardY = this.height - this.keyboardHeight;
    }

    _isBlackKey(note) {
        const n = note % 12;
        return [1, 3, 6, 8, 10].includes(n);
    }

    _countWhiteKeys() {
        let count = 0;
        for (let n = this.firstNote; n <= this.lastNote; n++) {
            if (!this._isBlackKey(n)) count++;
        }
        return count;
    }

    _noteX(note) {
        let whiteCount = 0;
        for (let n = this.firstNote; n < note; n++) {
            if (!this._isBlackKey(n)) whiteCount++;
        }
        const totalWhite = this._countWhiteKeys();
        const whiteWidth = this.width / totalWhite;

        if (this._isBlackKey(note)) {
            return whiteCount * whiteWidth - whiteWidth * 0.3;
        }
        return whiteCount * whiteWidth;
    }

    _noteWidth(note) {
        const totalWhite = this._countWhiteKeys();
        const whiteWidth = this.width / totalWhite;
        return this._isBlackKey(note) ? whiteWidth * 0.6 : whiteWidth;
    }

    update(data) {
        this.activeNotes = data.active || [];
        this.upcomingNotes = data.upcoming || [];
        this.elapsed = data.elapsed || 0;
        this.render();
    }

    setColors(right, left) {
        this.colors.right = right;
        this.colors.left = left;
    }

    render() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.width, this.height);

        // Background
        ctx.fillStyle = this.colors.background;
        ctx.fillRect(0, 0, this.width, this.height);

        // Vertical guide lines per white key
        this._drawGuideLines(ctx);

        // Falling notes
        this._drawFallingNotes(ctx);

        // Glow line at keyboard top
        this._drawGlowLine(ctx);

        // Piano keyboard
        this._drawKeyboard(ctx);
    }

    _drawGuideLines(ctx) {
        const totalWhite = this._countWhiteKeys();
        const whiteWidth = this.width / totalWhite;
        ctx.strokeStyle = this.colors.guideLine;
        ctx.lineWidth = 1;
        let wx = 0;
        for (let n = this.firstNote; n <= this.lastNote; n++) {
            if (this._isBlackKey(n)) continue;
            ctx.beginPath();
            ctx.moveTo(wx, 0);
            ctx.lineTo(wx, this.keyboardY);
            ctx.stroke();
            wx += whiteWidth;
        }
    }

    _drawGlowLine(ctx) {
        // Horizontal glow at keyboard boundary
        const grad = ctx.createLinearGradient(0, this.keyboardY - 6, 0, this.keyboardY + 2);
        grad.addColorStop(0, 'rgba(255,255,255,0)');
        grad.addColorStop(0.5, 'rgba(255,255,255,0.15)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, this.keyboardY - 6, this.width, 8);
    }

    _drawFallingNotes(ctx) {
        const pixelsPerSecond = this.keyboardY / this.window;

        for (const note of this.upcomingNotes) {
            const x = this._noteX(note.note);
            const w = this._noteWidth(note.note);
            const isRight = note.hand === 'right';
            const baseColor = isRight ? this.colors.right : this.colors.left;

            const timeUntilNote = note.start - this.elapsed;
            const y = this.keyboardY - (timeUntilNote * pixelsPerSecond);
            const h = Math.max(note.duration * pixelsPerSecond, 6);

            if (y + h < 0 || y > this.keyboardY) continue;

            const drawY = Math.max(0, y - h);
            const drawH = Math.min(h, this.keyboardY - drawY);
            const noteX = x + 2;
            const noteW = w - 4;
            const radius = Math.min(4, noteW / 2, drawH / 2);

            // Note glow
            ctx.save();
            ctx.shadowColor = baseColor;
            ctx.shadowBlur = 12;
            ctx.fillStyle = baseColor;
            ctx.beginPath();
            if (ctx.roundRect) {
                ctx.roundRect(noteX, drawY, noteW, drawH, radius);
            } else {
                ctx.rect(noteX, drawY, noteW, drawH);
            }
            ctx.fill();
            ctx.restore();

            // Bright gradient overlay on note
            const noteGrad = ctx.createLinearGradient(noteX, drawY, noteX + noteW, drawY);
            noteGrad.addColorStop(0, 'rgba(255,255,255,0.25)');
            noteGrad.addColorStop(0.5, 'rgba(255,255,255,0.05)');
            noteGrad.addColorStop(1, 'rgba(0,0,0,0.1)');
            ctx.fillStyle = noteGrad;
            ctx.beginPath();
            if (ctx.roundRect) {
                ctx.roundRect(noteX, drawY, noteW, drawH, radius);
            } else {
                ctx.rect(noteX, drawY, noteW, drawH);
            }
            ctx.fill();

            // Top highlight edge
            if (drawH > 8) {
                ctx.fillStyle = 'rgba(255,255,255,0.3)';
                ctx.beginPath();
                if (ctx.roundRect) {
                    ctx.roundRect(noteX, drawY, noteW, 3, [radius, radius, 0, 0]);
                } else {
                    ctx.rect(noteX, drawY, noteW, 3);
                }
                ctx.fill();
            }
        }
    }

    _drawKeyboard(ctx) {
        const totalWhite = this._countWhiteKeys();
        const whiteWidth = this.width / totalWhite;
        const blackWidth = whiteWidth * 0.6;
        const blackHeight = this.keyboardHeight * 0.62;
        const y = this.keyboardY;

        const activeSet = new Map();
        for (const n of this.activeNotes) {
            activeSet.set(n.note, n.hand);
        }

        // White keys
        let wx = 0;
        for (let n = this.firstNote; n <= this.lastNote; n++) {
            if (this._isBlackKey(n)) continue;
            const isActive = activeSet.has(n);

            if (isActive) {
                const hand = activeSet.get(n);
                const color = hand === 'right' ? this.colors.right : this.colors.left;
                // Glowing active key
                ctx.save();
                ctx.shadowColor = color;
                ctx.shadowBlur = 15;
                ctx.fillStyle = color;
                ctx.fillRect(wx + 1, y, whiteWidth - 2, this.keyboardHeight);
                ctx.restore();
                // Lighter top
                const keyGrad = ctx.createLinearGradient(0, y, 0, y + this.keyboardHeight);
                keyGrad.addColorStop(0, 'rgba(255,255,255,0.3)');
                keyGrad.addColorStop(1, 'rgba(0,0,0,0.1)');
                ctx.fillStyle = keyGrad;
                ctx.fillRect(wx + 1, y, whiteWidth - 2, this.keyboardHeight);
            } else {
                // Normal white key with subtle gradient
                const keyGrad = ctx.createLinearGradient(0, y, 0, y + this.keyboardHeight);
                keyGrad.addColorStop(0, '#f0f0f0');
                keyGrad.addColorStop(0.85, '#d8d8d8');
                keyGrad.addColorStop(1, '#c0c0c0');
                ctx.fillStyle = keyGrad;
                ctx.fillRect(wx + 1, y, whiteWidth - 2, this.keyboardHeight);
            }

            // Key separator
            ctx.strokeStyle = 'rgba(0,0,0,0.2)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(wx, y);
            ctx.lineTo(wx, y + this.keyboardHeight);
            ctx.stroke();

            wx += whiteWidth;
        }

        // Bottom edge of keyboard
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(0, y + this.keyboardHeight - 3, this.width, 3);

        // Black keys
        wx = 0;
        for (let n = this.firstNote; n <= this.lastNote; n++) {
            if (this._isBlackKey(n)) {
                const isActive = activeSet.has(n);
                const bx = wx - blackWidth / 2;

                if (isActive) {
                    const hand = activeSet.get(n);
                    const color = hand === 'right' ? this.colors.right : this.colors.left;
                    ctx.save();
                    ctx.shadowColor = color;
                    ctx.shadowBlur = 12;
                    ctx.fillStyle = color;
                    ctx.beginPath();
                    if (ctx.roundRect) {
                        ctx.roundRect(bx, y, blackWidth, blackHeight, [0, 0, 3, 3]);
                    } else {
                        ctx.rect(bx, y, blackWidth, blackHeight);
                    }
                    ctx.fill();
                    ctx.restore();
                } else {
                    // Black key with gradient for 3D effect
                    const bkGrad = ctx.createLinearGradient(bx, y, bx, y + blackHeight);
                    bkGrad.addColorStop(0, '#2a2a2a');
                    bkGrad.addColorStop(0.7, '#1a1a1a');
                    bkGrad.addColorStop(1, '#111');
                    ctx.fillStyle = bkGrad;
                    ctx.beginPath();
                    if (ctx.roundRect) {
                        ctx.roundRect(bx, y, blackWidth, blackHeight, [0, 0, 3, 3]);
                    } else {
                        ctx.rect(bx, y, blackWidth, blackHeight);
                    }
                    ctx.fill();

                    // Subtle shine on top
                    const shineGrad = ctx.createLinearGradient(bx, y, bx + blackWidth, y);
                    shineGrad.addColorStop(0, 'rgba(255,255,255,0.05)');
                    shineGrad.addColorStop(0.4, 'rgba(255,255,255,0.1)');
                    shineGrad.addColorStop(1, 'rgba(255,255,255,0)');
                    ctx.fillStyle = shineGrad;
                    ctx.fillRect(bx, y, blackWidth, blackHeight * 0.3);
                }
            } else {
                wx += whiteWidth;
            }
        }
    }
}
