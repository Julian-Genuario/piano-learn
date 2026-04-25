# PianoLearn - Sistema LED para Aprender Piano

Sistema de LEDs WS2812B para aprender piano con guía visual estilo Synthesia. Notas cayendo en tiempo real, coloreadas por mano (derecha=verde, izquierda=cyan).

## Requisitos

### PC Windows
- Python 3.10+ (NO Python 3.14, incompatible con basic-pitch)
- FFmpeg (descargable automáticamente vía yt-dlp)
- Deno (para transcodificación, descargable automáticamente)

### Raspberry Pi 4
- Raspberry Pi 4 (2GB RAM mínimo, 16GB SD)
- Python 3.9+
- GPIO acceso para LEDs WS2812B

## Instalación PC Windows

### 1. Crear entorno virtual
```bash
cd piano-learn
python -m venv .venv
.\.venv\Scripts\activate
```

### 2. Instalar dependencias
```bash
pip install -r requirements-pc.txt
```

### 3. Ejecutar

**Servidor de Piano (modo mock, sin LEDs reales):**
```bash
python run_server.py --mock
```
Abre en navegador: **http://localhost:8000**

**Extractor MIDI (YouTube → MIDI):**
```bash
python run_extractor.py
```
Abre en navegador: **http://localhost:8001**

O usa los scripts VBS para ejecutar en background:
- `start_pianolearn.vbs` — inicia servidor de piano
- `start_extractor.vbs` — inicia extractor MIDI

## Instalación Raspberry Pi

### 1. SSH a la Pi
```bash
ssh pi@pianolearn.local
```

### 2. Clonar o copiar código
```bash
# Opción A: Copiar carpeta desde PC vía SCP
scp -r ~/Desktop/piano-learn pi@pianolearn.local:~/

# Opción B: Ya está en la Pi
cd ~/piano-learn
```

### 3. Crear entorno virtual
```bash
python3 -m venv .venv
source .venv/bin/activate
```

### 4. Instalar dependencias
```bash
pip install -r requirements-pi.txt
```

### 5. Configurar GPIO para LEDs (si tienes LEDs conectados)
```bash
# Asegurate que el usuario 'pi' tiene acceso GPIO
sudo usermod -a -G gpio pi
sudo reboot
```

### 6. Ejecutar servidor (con LEDs reales)
```bash
python run_server.py
```

Desde tablet/laptop en la red: **http://pianolearn.local:8000**

### 7. (Opcional) Ejecutar como servicio systemd
```bash
sudo cp deploy.sh /usr/local/bin/pianolearn
sudo chmod +x /usr/local/bin/pianolearn

# Ver estado
sudo systemctl status pianolearn

# Reiniciar
sudo systemctl restart pianolearn
```

## Estructura

```
piano-learn/
├── pianolearn/              # Servidor FastAPI + frontend web
│   ├── server.py           # FastAPI app
│   ├── midi_parser.py      # Parse MIDI → notas con hand (L/R)
│   ├── midi_player.py      # Playback engine
│   ├── led_controller.py   # Control LEDs WS2812B (GPIO)
│   ├── midi_input.py       # Lectura MIDI USB (teclado)
│   ├── profiles.py         # Sistema de perfiles usuario
│   ├── song_library.py     # Gestión de canciones
│   └── static/             # Frontend (HTML/CSS/JS/Canvas)
│       ├── index.html
│       ├── app.js          # App lógica
│       ├── piano-canvas.js # Rendering notas cayendo + teclado
│       ├── piano-audio.js  # Web Audio API síntesis
│       ├── score-canvas.js # Visor de partitura
│       └── styles.css
├── midi_extractor/         # Herramienta YouTube → MIDI
│   ├── pipeline.py         # Workflow: download → separate → transcribe
│   ├── downloader.py       # yt-dlp
│   ├── separator.py        # demucs (separación de piano)
│   ├── transcriber.py      # basic-pitch (transcripción)
│   ├── web.py              # UI web
│   └── templates/          # HTML upload
├── songs/                  # Carpeta de MIDIs
├── data/                   # Perfiles + metadata
├── run_server.py          # Punto de entrada servidor
├── run_extractor.py       # Punto de entrada extractor
├── requirements-pc.txt    # Deps Windows
├── requirements-pi.txt    # Deps Raspberry Pi
└── deploy.sh              # Script systemd

```

## Configuración

### Hardware LEDs
- GPIO: 18 (BCM) en Pi
- Tipo: WS2812B (NeoPixel)
- Cantidad: Ajustar en `led_controller.py` → `num_leds`

### MIDI Input
- Teclado USB MIDI 88 teclas
- Detecta automáticamente por puerto
- Activa colores en tiempo real

### Colores (personalizable)
- Mano derecha: Verde (#00FF00)
- Mano izquierda: Cyan (#00FFFF)
- Edita en Ajustes → dentro de la app

## Troubleshooting

**"ModuleNotFoundError: No module named 'basic_pitch'"**
- Windows: Python 3.14 no soporta. Usa Python 3.10-3.13
- Usa CLI fallback: `basic-pitch` command line

**LEDs no funcionan en Pi**
- Verifica GPIO 18 conectado al DIN del strip
- Revisa permisos: `groups pi` debe incluir `gpio`
- Test: `python -c "from neopixel import Neopixel; np = Neopixel(18, 10); np.fill((255,0,0)); np.show()"`

**Página web no carga**
- Windows: http://localhost:8000
- Pi: http://pianolearn.local:8000 (o IP: http://192.168.x.x:8000)
- Verifica firewall/puerto 8000

**MIDI extraction lento/cuelga**
- Limpia `separated/` y `data/` si están muy llenos
- Aumenta timeout en `pipeline.py`

## Desarrollo

### Activar cambios sin reiniciar
- Frontend (HTML/CSS/JS): Recarga navegador (Ctrl+Shift+R fuerza caché)
- Backend: Reinicia `run_server.py`

### Modificar colores
- `pianolearn/static/piano-canvas.js` → línea ~11 `this.colors`
- O en la app: Ajustes → Colores

### Agregar canciones
1. Upload MIDI: Botón "MIDI" en la app
2. O YouTube: Botón "YouTube" → URL → Extrae automáticamente

---

**Última actualización:** 2026-04-25
**Versión:** 1.0
