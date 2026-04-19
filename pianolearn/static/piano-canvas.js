class PianoCanvas {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');

        this.firstNote = 36;  // C2
        this.lastNote = 96;   // C7

        // Synthesia colors
        this.colors = {
            right: '#1E90FF',      // blue
            rightDark: '#0a4a8a',
            rightGlow: '#4db8ff',
            left: '#00C853',       // green
            leftDark: '#006b2b',
            leftGlow: '#66ff99',
            wrong: '#ff1744',
            background: '#000000'
        };

        // Keyboard proportions (Synthesia-like)
        this.keyboardRatio = 0.18;  // keyboard = 18% of height
        this.activeNotes = [];
        this.upcomingNotes = [];
        this.elapsed = 0;
        this.window = 3.0;

        // Precompute key layout
        this._buildKeyLayout();
        this._resize();
        window.addEventListener('resize', () => {
            this._buildKeyLayout();
            this._resize();
        });
    }

    _isBlackKey(note) {
        return [1, 3, 6, 8, 10].includes(note % 12);
    }

    _buildKeyLayout() {
        // Count white keys
        this.whiteKeys = [];
        this.blackKeys = [];
        for (let n = this.firstNote; n <= this.lastNote; n++) {
            if (!this._isBlackKey(n)) this.whiteKeys.push(n);
            else this.blackKeys.push(n);
        }
        this.numWhite = this.whiteKeys.length;
    }

    _resize() {
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = this.canvas.clientWidth * dpr;
        this.canvas.height = this.canvas.clientHeight * dpr;
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.width = this.canvas.clientWidth;
        this.height = this.canvas.clientHeight;
        this.keyboardHeight = Math.floor(this.height * this.keyboardRatio);
        this.keyboardY = this.height - this.keyboardHeight;
        this.whiteKeyWidth = this.width / this.numWhite;
        this.blackKeyWidth = this.whiteKeyWidth * 0.58;
        this.blackKeyHeight = this.keyboardHeight * 0.63;
    }

    // Get X position and width for any note
    _getNoteRect(note) {
        let whiteIndex = 0;
        for (let n = this.firstNote; n < note; n++) {
            if (!this._isBlackKey(n)) whiteIndex++;
        }
        if (this._isBlackKey(note)) {
            const x = whiteIndex * this.whiteKeyWidth - this.blackKeyWidth / 2;
            return { x, w: this.blackKeyWidth };
        }
        return { x: whiteIndex * this.whiteKeyWidth, w: this.whiteKeyWidth };
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
        // Generate dark/glow variants
        this.colors.rightDark = this._darken(right, 0.4);
        this.colors.rightGlow = this._lighten(right, 0.4);
        this.colors.leftDark = this._darken(left, 0.4);
        this.colors.leftGlow = this._lighten(left, 0.4);
    }

    _darken(hex, amount) {
        const r = Math.floor(parseInt(hex.slice(1,3),16) * (1-amount));
        const g = Math.floor(parseInt(hex.slice(3,5),16) * (1-amount));
        const b = Math.floor(parseInt(hex.slice(5,7),16) * (1-amount));
        return `rgb(${r},${g},${b})`;
    }

    _lighten(hex, amount) {
        const r = Math.min(255, Math.floor(parseInt(hex.slice(1,3),16) * (1+amount)));
        const g = Math.min(255, Math.floor(parseInt(hex.slice(3,5),16) * (1+amount)));
        const b = Math.min(255, Math.floor(parseInt(hex.slice(5,7),16) * (1+amount)));
        return `rgb(${r},${g},${b})`;
    }

    render() {
        const ctx = this.ctx;
        // Pure black background
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, this.width, this.height);

        this._drawFallingNotes(ctx);
        this._drawHitLine(ctx);
        this._drawKeyboard(ctx);
    }

    _drawHitLine(ctx) {
        // Bright line where notes meet keys (like Synthesia)
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(0, this.keyboardY - 1, this.width, 2);
    }

    _drawFallingNotes(ctx) {
        const pps = this.keyboardY / this.window; // pixels per second

        for (const note of this.upcomingNotes) {
            const { x, w } = this._getNoteRect(note.note);
            const isRight = note.hand === 'right';
            const color = isRight ? this.colors.right : this.colors.left;
            const colorDark = isRight ? this.colors.rightDark : this.colors.leftDark;
            const colorGlow = isRight ? this.colors.rightGlow : this.colors.leftGlow;

            const dt = note.start - this.elapsed;
            const noteBottom = this.keyboardY - dt * pps;
            const noteH = Math.max(note.duration * pps, 8);
            const noteTop = noteBottom - noteH;

            // Off-screen check
            if (noteBottom < 0 || noteTop > this.keyboardY) continue;

            // Clamp to visible area
            const drawTop = Math.max(0, noteTop);
            const drawBottom = Math.min(this.keyboardY, noteBottom);
            const drawH = drawBottom - drawTop;
            if (drawH <= 0) continue;

            const margin = this._isBlackKey(note.note) ? 1 : 2;
            const nx = x + margin;
            const nw = w - margin * 2;
            const radius = Math.min(3, nw / 2);

            // Main note body - solid block like Synthesia
            ctx.fillStyle = color;
            ctx.beginPath();
            if (ctx.roundRect) {
                ctx.roundRect(nx, drawTop, nw, drawH, radius);
            } else {
                ctx.rect(nx, drawTop, nw, drawH);
            }
            ctx.fill();

            // Left edge highlight (3D depth)
            ctx.fillStyle = colorGlow;
            ctx.globalAlpha = 0.3;
            ctx.fillRect(nx, drawTop, 2, drawH);
            ctx.globalAlpha = 1;

            // Right edge shadow
            ctx.fillStyle = colorDark;
            ctx.globalAlpha = 0.4;
            ctx.fillRect(nx + nw - 2, drawTop, 2, drawH);
            ctx.globalAlpha = 1;

            // Top cap (rounded bright end)
            if (noteTop >= 0) {
                const capH = Math.min(4, drawH);
                const capGrad = ctx.createLinearGradient(0, drawTop, 0, drawTop + capH);
                capGrad.addColorStop(0, colorGlow);
                capGrad.addColorStop(1, color);
                ctx.fillStyle = capGrad;
                ctx.beginPath();
                if (ctx.roundRect) {
                    ctx.roundRect(nx, drawTop, nw, capH, [radius, radius, 0, 0]);
                } else {
                    ctx.rect(nx, drawTop, nw, capH);
                }
                ctx.fill();
            }

            // Glow effect when note is touching the keyboard
            if (noteBottom >= this.keyboardY - 5) {
                ctx.save();
                ctx.shadowColor = color;
                ctx.shadowBlur = 25;
                ctx.fillStyle = color;
                ctx.globalAlpha = 0.6;
                ctx.fillRect(nx, this.keyboardY - 4, nw, 4);
                ctx.restore();
                ctx.globalAlpha = 1;
            }
        }
    }

    _drawKeyboard(ctx) {
        const y = this.keyboardY;
        const kh = this.keyboardHeight;
        const ww = this.whiteKeyWidth;
        const bw = this.blackKeyWidth;
        const bh = this.blackKeyHeight;

        // Build active note map
        const activeMap = new Map();
        for (const n of this.activeNotes) {
            activeMap.set(n.note, n.hand);
        }

        // --- White keys ---
        for (let i = 0; i < this.numWhite; i++) {
            const note = this.whiteKeys[i];
            const kx = i * ww;
            const active = activeMap.has(note);

            if (active) {
                const hand = activeMap.get(note);
                const color = hand === 'right' ? this.colors.right : this.colors.left;
                const glow = hand === 'right' ? this.colors.rightGlow : this.colors.leftGlow;

                // Glowing key
                ctx.save();
                ctx.shadowColor = color;
                ctx.shadowBlur = 20;
                ctx.shadowOffsetY = -5;

                const grad = ctx.createLinearGradient(0, y, 0, y + kh);
                grad.addColorStop(0, glow);
                grad.addColorStop(0.3, color);
                grad.addColorStop(1, this._darken(color.startsWith('#') ? color : '#1E90FF', 0.3));
                ctx.fillStyle = grad;
                ctx.fillRect(kx + 1, y, ww - 2, kh - 1);
                ctx.restore();
            } else {
                // Normal white key - Synthesia style gradient
                const grad = ctx.createLinearGradient(0, y, 0, y + kh);
                grad.addColorStop(0, '#e8e8e8');
                grad.addColorStop(0.02, '#f5f5f5');
                grad.addColorStop(0.8, '#e0e0e0');
                grad.addColorStop(0.95, '#c8c8c8');
                grad.addColorStop(1, '#b0b0b0');
                ctx.fillStyle = grad;
                ctx.fillRect(kx + 1, y, ww - 2, kh - 1);
            }

            // Key separator line
            ctx.fillStyle = 'rgba(0,0,0,0.25)';
            ctx.fillRect(kx, y, 1, kh);
        }

        // Right border of last key
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(this.numWhite * ww, y, 1, kh);

        // Bottom shadow of keyboard
        ctx.fillStyle = '#333';
        ctx.fillRect(0, y + kh - 2, this.width, 2);

        // --- Black keys ---
        let whiteIdx = 0;
        for (let n = this.firstNote; n <= this.lastNote; n++) {
            if (!this._isBlackKey(n)) {
                whiteIdx++;
                continue;
            }

            const bx = whiteIdx * ww - bw / 2;
            const active = activeMap.has(n);

            if (active) {
                const hand = activeMap.get(n);
                const color = hand === 'right' ? this.colors.right : this.colors.left;
                const glow = hand === 'right' ? this.colors.rightGlow : this.colors.leftGlow;

                ctx.save();
                ctx.shadowColor = color;
                ctx.shadowBlur = 15;

                const grad = ctx.createLinearGradient(0, y, 0, y + bh);
                grad.addColorStop(0, glow);
                grad.addColorStop(0.4, color);
                grad.addColorStop(1, this._darken(color.startsWith('#') ? color : '#1E90FF', 0.4));
                ctx.fillStyle = grad;
                ctx.beginPath();
                if (ctx.roundRect) {
                    ctx.roundRect(bx, y, bw, bh, [0, 0, 3, 3]);
                } else {
                    ctx.rect(bx, y, bw, bh);
                }
                ctx.fill();
                ctx.restore();
            } else {
                // Normal black key - layered gradient for realism
                const grad = ctx.createLinearGradient(0, y, 0, y + bh);
                grad.addColorStop(0, '#3a3a3a');
                grad.addColorStop(0.05, '#2d2d2d');
                grad.addColorStop(0.4, '#1f1f1f');
                grad.addColorStop(0.85, '#161616');
                grad.addColorStop(1, '#0a0a0a');
                ctx.fillStyle = grad;
                ctx.beginPath();
                if (ctx.roundRect) {
                    ctx.roundRect(bx, y, bw, bh, [0, 0, 3, 3]);
                } else {
                    ctx.rect(bx, y, bw, bh);
                }
                ctx.fill();

                // Top shine strip
                const shine = ctx.createLinearGradient(bx, y, bx + bw, y);
                shine.addColorStop(0, 'rgba(255,255,255,0)');
                shine.addColorStop(0.3, 'rgba(255,255,255,0.08)');
                shine.addColorStop(0.7, 'rgba(255,255,255,0.05)');
                shine.addColorStop(1, 'rgba(255,255,255,0)');
                ctx.fillStyle = shine;
                ctx.fillRect(bx + 1, y + 1, bw - 2, bh * 0.2);

                // Side edges for depth
                ctx.fillStyle = 'rgba(0,0,0,0.5)';
                ctx.fillRect(bx, y, 1, bh);
                ctx.fillRect(bx + bw - 1, y, 1, bh);
            }
        }
    }
}
