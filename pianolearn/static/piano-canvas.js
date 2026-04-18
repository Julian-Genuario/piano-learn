class PianoCanvas {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');

        this.firstNote = 36;
        this.lastNote = 96;
        this.totalKeys = this.lastNote - this.firstNote;

        this.colors = {
            right: '#0064ff',
            left: '#00ff64',
            wrong: '#ff0000',
            whiteKey: '#1a1a2e',
            blackKey: '#0a0a1a',
            keyBorder: '#333',
            background: '#0a0a1a'
        };

        this.keyboardHeight = 80;
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

        ctx.fillStyle = this.colors.background;
        ctx.fillRect(0, 0, this.width, this.height);

        this._drawFallingNotes(ctx);
        this._drawKeyboard(ctx);
    }

    _drawFallingNotes(ctx) {
        const pixelsPerSecond = this.keyboardY / this.window;

        for (const note of this.upcomingNotes) {
            const x = this._noteX(note.note);
            const w = this._noteWidth(note.note);
            const color = note.hand === 'right' ? this.colors.right : this.colors.left;

            const timeUntilNote = note.start - this.elapsed;
            const y = this.keyboardY - (timeUntilNote * pixelsPerSecond);
            const h = note.duration * pixelsPerSecond;

            if (y + h < 0 || y > this.keyboardY) continue;

            const drawY = Math.max(0, y - h);
            const drawH = Math.min(h, this.keyboardY - drawY);

            ctx.fillStyle = color;
            ctx.globalAlpha = 0.8;
            ctx.beginPath();
            if (ctx.roundRect) {
                ctx.roundRect(x + 1, drawY, w - 2, drawH, 4);
            } else {
                ctx.rect(x + 1, drawY, w - 2, drawH);
            }
            ctx.fill();
            ctx.globalAlpha = 1.0;
        }
    }

    _drawKeyboard(ctx) {
        const totalWhite = this._countWhiteKeys();
        const whiteWidth = this.width / totalWhite;
        const blackWidth = whiteWidth * 0.6;
        const blackHeight = this.keyboardHeight * 0.6;
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
                ctx.fillStyle = hand === 'right' ? this.colors.right : this.colors.left;
            } else {
                ctx.fillStyle = this.colors.whiteKey;
            }

            ctx.fillRect(wx, y, whiteWidth - 1, this.keyboardHeight);
            ctx.strokeStyle = this.colors.keyBorder;
            ctx.strokeRect(wx, y, whiteWidth - 1, this.keyboardHeight);
            wx += whiteWidth;
        }

        // Black keys
        wx = 0;
        for (let n = this.firstNote; n <= this.lastNote; n++) {
            if (this._isBlackKey(n)) {
                const isActive = activeSet.has(n);
                if (isActive) {
                    const hand = activeSet.get(n);
                    ctx.fillStyle = hand === 'right' ? this.colors.right : this.colors.left;
                } else {
                    ctx.fillStyle = this.colors.blackKey;
                }

                const bx = wx - blackWidth / 2;
                ctx.fillRect(bx, y, blackWidth, blackHeight);
                ctx.strokeStyle = '#111';
                ctx.strokeRect(bx, y, blackWidth, blackHeight);
            } else {
                wx += whiteWidth;
            }
        }
    }
}
