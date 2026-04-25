# PianoLearn - Plan Completo del Proyecto

## 📋 Resumen Ejecutivo

**PianoLearn** es un sistema de aprendizaje de piano interactivo con visualización de notas en caída (Synthesia-style) y retroalimentación de LEDs físicos. El usuario carga archivos MIDI, los reproduce visualmente con notas cayendo, y escucha audio sintetizado con técnicas avanzadas de procesamiento.

**Estado:** Funcional en desarrollo. Audio: En corrección de notas sostenidas cortadas.

---

## 🏗 Arquitectura General

```
┌─────────────────────────────────────────────────────────────┐
│                    NAVEGADOR (Frontend)                     │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  index.html                                          │   │
│  │  ├─ piano-canvas.js (Visualización de notas)        │   │
│  │  ├─ piano-audio.js (Síntesis de audio Web Audio API)│   │
│  │  └─ app.js (Lógica de control)                      │   │
│  └──────────────────────────────────────────────────────┘   │
│           ↕ WebSocket (/ws/player)                          │
│           ↕ HTTP API (/api/*)                               │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                 SERVIDOR FastAPI (Backend)                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  server.py                                           │   │
│  │  ├─ Endpoints de canciones (/api/songs)             │   │
│  │  ├─ Control de reproducción (/api/player)           │   │
│  │  ├─ WebSocket de estado en vivo                      │   │
│  │  └─ Control de LEDs (/api/leds)                     │   │
│  └──────────────────────────────────────────────────────┘   │
│           ↓                                                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  midi_parser.py → Convierte MIDI a NoteEvent        │   │
│  │  midi_player.py → Gestor de reproducción/timing     │   │
│  │  led_controller.py → Control de LEDs físicos        │   │
│  │  song_library.py → Gestión de archivos MIDI         │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 📁 Estructura de Archivos

```
piano-learn/
├── INICIAR.bat                    # ⭐ Ejecutable único - Inicia servidor y abre navegador
├── run_server.py                  # Script para iniciar el servidor FastAPI
├── pianolearn/
│   ├── __init__.py
│   ├── server.py                  # Servidor FastAPI principal
│   ├── midi_parser.py             # Parse de archivos MIDI → NoteEvent
│   ├── midi_player.py             # Reproductor con timing y modos (karaoke/learning)
│   ├── midi_input.py              # Entrada MIDI desde teclado físico
│   ├── led_controller.py          # Control de LEDs (mocking cuando --mock)
│   ├── song_library.py            # Gestión de biblioteca de canciones
│   ├── profiles.py                # Configuración/perfiles
│   └── static/
│       ├── index.html             # Página principal (HTML)
│       ├── styles.css             # Estilos CSS
│       ├── piano-audio.js         # ⭐ CRÍTICO: Síntesis de audio
│       ├── piano-canvas.js        # ⭐ CRÍTICO: Visualización en canvas
│       └── app.js                 # ⭐ CRÍTICO: Lógica de control/estado
└── songs/                         # Carpeta de archivos MIDI (cargada automáticamente)
```

---

## 🎵 Componentes Clave

### 1. **INICIAR.bat** (Punto de entrada)
**Función:** Un clic inicia todo.
```batch
@echo off
taskkill /f /im python.exe /im pythonw.exe >nul 2>&1  # Mata procesos Python previos
python run_server.py --mock                            # Inicia servidor con LEDs simulados
start http://localhost:8000                            # Abre navegador
```

**Importante:** Debe ser el ÚNICO archivo que el usuario ejecute. Si no funciona, verificar:
- Python instalado y en PATH
- Puerto 8000 disponible
- Carpeta `songs/` existe

---

### 2. **server.py** (Backend - FastAPI)

**Puerto:** `localhost:8000`

**Endpoints principales:**
| Endpoint | Método | Función |
|----------|--------|---------|
| `/` | GET | Sirve index.html |
| `/api/songs` | GET | Lista canciones disponibles |
| `/api/songs/{name}` | GET | Obtiene datos de canción |
| `/api/songs/upload` | POST | Sube nuevo MIDI |
| `/api/player/play/{song}` | POST | Inicia reproducción |
| `/api/player/pause` | POST | Pausa/resume |
| `/api/player/stop` | POST | Detiene y limpia |
| `/api/player/speed` | POST | Ajusta velocidad (0.25x a 1.5x) |
| `/api/player/mode` | POST | Cambia modo (karaoke/learning) |
| `/ws/player` | WebSocket | **CRÍTICO:** Envía notas activas cada 33ms (~30fps) |

**Lógica WebSocket (línea 178-214):**
```python
while True:
    if state["playing"] and state["player"]:
        elapsed = time.time() - state["start_time"]
        # get_active_notes retorna notas que DEBEN estar sonando AHORA
        active = player.get_active_notes(elapsed)
        # get_upcoming_notes retorna notas que caerán en los próximos 3 segundos
        upcoming = player.get_upcoming_notes(elapsed, window=3.0)
        
        await ws.send_json({
            "active": [...],      # Notas que deben sonar YA
            "upcoming": [...],    # Notas próximas para visualización
            "elapsed": scaled_time
        })
    await asyncio.sleep(0.033)  # 30 FPS
```

**Problema conocido (RESUELTO):** El `elapsed` debe estar escalado por velocidad cuando se envía al cliente, pero sin escalar cuando se pasa a get_active_notes (que hace su propio scaling).

---

### 3. **midi_parser.py** (Convertir MIDI a eventos)

**Función:** Lee archivo .mid y retorna lista de `NoteEvent`

```python
@dataclass
class NoteEvent:
    note: int          # 0-127 (21=A0 grave, 108=C8 agudo)
    start_time: float  # Segundos desde inicio
    duration: float    # Cuánto tiempo suena (start_on a note_off)
    velocity: int      # 0-127 (dinámicaexprensión)
    hand: str          # "right" o "left"
```

**Lógica de detección de mano (línea 67-80):**
1. Si track se llama "right", "treble", "melody" → right
2. Si track se llama "left", "bass", "accomp" → left
3. Si hay 2 tracks sin nombre → primer track = right, segundo = left
4. Si hay 1 track → notas >= MIDI 60 (C3) = right, < 60 = left

**Problema conocido (RESUELTO):** Las manos no se diferenciaban. Ahora se skippean tracks vacíos.

---

### 4. **midi_player.py** (Reproductor con timing)

**Métodos principales:**

| Método | Retorna | Uso |
|--------|---------|-----|
| `get_active_notes(current_time)` | Lista de NoteEvent | ¿Qué notas suenan AHORA? |
| `get_upcoming_notes(current_time, window=3.0)` | Lista de NoteEvent | ¿Qué notas caerán en los próximos 3s? |
| `get_waiting_notes()` | Lista de NoteEvent | (Modo learning) ¿Qué nota espera el usuario? |

**Lógica crítica (línea 16-20):**
```python
def get_active_notes(self, current_time: float) -> list[NoteEvent]:
    scaled_time = current_time * self.speed
    return [
        e for e in self.events
        if e.start_time <= scaled_time < e.start_time + e.duration
    ]
```

**Una nota está activa SOLO si:** `start_time <= scaled_time < start_time + duration`
- Cuando `scaled_time >= start_time + duration`, noteOff se dispara

---

### 5. **piano-audio.js** (⭐ CRÍTICO: Síntesis de audio)

**Responsabilidad:** Reproducir audio de piano con técnicas avanzadas.

**Flujo:**
```javascript
noteOn(note, velocity)  // Toca una nota
    ↓
    Si !this.loaded: _oscNoteOn() // Fallback: oscilador triangle
    Si this.loaded: samples       // Preferido: piano samples MP3

noteOff(note)  // Suelta una nota
    ↓
    Programa release envelope (desvanecimiento natural)
```

**Configuración de Audio (línea 14-40):**

| Componente | Valor | Propósito |
|------------|-------|----------|
| masterGain | 0.6 | Volumen principal (0-1) |
| compressor.threshold | -15 dB | Solo comprime notas fuertes |
| compressor.ratio | 1.5 | Compresión suave (no agresiva) |
| compressor.knee | 8 dB | Transición suave a compresión |
| compressor.release | 0.25 s | Recuperación rápida |
| reverb | 0.04 gain | Espacio acústico sutil |

**Problema conocido (RESUELTO):** Notas sostenidas se cortaban a los 3s → Eliminado límite en oscilador fallback.

**Carga de Samples (línea 83-134):**
```javascript
_loadSamples() {
    // Descarga 88 MP3s en lotes de 12 desde:
    // https://gleitz.github.io/midi-js-soundfonts/FatBoy/acoustic_grand_piano-mp3/
    // Toma ~10-30 segundos (depende de conexión)
    // Mientras carga, usa oscilador fallback
}
```

**noteOn - Reproducción de Sample (línea 156-225):**
```javascript
noteOn(note, velocity) {
    // 1. Busca sample más cercano (usualmente exacto, hay 88)
    const sampleNote = this._findClosestSample(note);
    const buffer = this.samples[sampleNote];
    const source = this.ctx.createBufferSource();
    
    // 2. Pitch shift si es necesario (raro con 88 notas)
    source.playbackRate.value = Math.pow(2, semitones / 12);
    
    // 3. Attack envelope (ataque rápido si velocity alta, lento si baja)
    const attackTime = 0.004 + (1 - velNorm) * 0.012;  // 0.004-0.016s
    const vol = velNorm * 0.65 + 0.10;                  // 0.10-0.75 range
    
    // 4. Filtro pasa-bajos (notas suaves = 2kHz, fuertes = 16kHz)
    filter.frequency.value = 2000 + velNorm * 14000;
    
    // 5. Panning estéreo (bajos izquierda, agudos derecha)
    panner.pan.value = ((note - 21) / (108 - 21) - 0.5) * 0.7;
    
    // Cadena: source → filter → gain → panner → masterGain → compressor → out
}
```

**noteOff - Release Envelope (línea 227-265):**
```javascript
noteOff(note) {
    // 1. Calcula release time (bajos resuenan más)
    const releaseTime = 0.15 + Math.max(0, (72 - note) / 60) * 0.25;
    // Notas altas (>72): 0.15s
    // Notas bajas (<72): 0.15-0.45s
    
    // 2. Envolvente de damper (dos fases):
    // Fase 1: Linear ramp a 15% en (releaseTime * 0.15) [golpe del damper]
    // Fase 2: Exponential decay a silencio en (releaseTime * 0.85) [tail natural]
    gain.gain.linearRampToValueAtTime(currentVal * 0.15, now + releaseTime * 0.15);
    gain.gain.exponentialRampToValueAtTime(0.001, now + releaseTime);
    
    // 3. Cierra filtro durante release (darkening effect)
    filter.frequency.exponentialRampToValueAtTime(800, now + releaseTime * 0.5);
    
    // 4. Detiene source después de que termine envelope
    entry.source.stop(now + releaseTime + 0.02);
}
```

**Características avanzadas:**
- ✅ Velocity-dependent brightness (bajos = cálidos, altos = brillantes)
- ✅ Piano-like damper simulation (two-phase envelope)
- ✅ Stereo panning (diferencia izquierda/derecha)
- ✅ Reverb space (4% wet signal)
- ✅ Dynamic compressor (evita clipping)
- ✅ Re-articulation crossfade (misma nota tocada 2x rápido = smooth)

---

### 6. **piano-canvas.js** (Visualización Synthesia-style)

**Responsabilidad:** Dibujar notas cayendo y teclado interactivo.

**Pantalla:**
```
┌─────────────────────────────────────────────────────┐
│                 FALLING NOTES AREA (82%)             │
│  ┌───────────────────────────────────────────────┐  │
│  │ ♪ Notas cayendo (color: right=azul, left=verde) │
│  │ Con bordes negros 3px y brillo blanco          │
│  └───────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────┤
│  HIT LINE (línea blanca donde tocar notas)          │
├─────────────────────────────────────────────────────┤
│         TECLADO INTERACTIVO (18%)                   │
│  [ ] [ ][ ] [ ][ ][ ][ ][ ] ...                     │
│   W   B B   B   B   B   B                           │
│   hite  l a c k                                    │
└─────────────────────────────────────────────────────┘
```

**Configuración (línea 1-35):**
- firstNote: MIDI 36 (C2)
- lastNote: MIDI 96 (C7)
- 52 teclas blancas, 31 negras
- Colores: right=#1E90FF (azul Synthesia), left=#00C853 (verde)

**update(data) - Recibe WebSocket:**
```javascript
update({
    active: [{note: 60, hand: 'right', velocity: 100}, ...],
    upcoming: [{note: 60, hand: 'right', start: 0.5, duration: 1.2}, ...],
    elapsed: 2.34
})
```

**_drawFallingNotes(ctx) - Renderizado de notas (línea 127-204):**
- Proyecta upcoming notes en y=0 (parte superior) a y=keyboardY (línea de impacto)
- Posición vertical: `noteBottom = keyboardY - (note.start - elapsed) * pps`
  - pps = pixels per second
- Bordes negros 3px + glow blanco 1px para claridad visual
- Gap de 2px entre notas para separación

---

### 7. **app.js** (Lógica de control y estado)

**Flujo al reproducir una canción:**

```javascript
playSong("Moonlight Sonata")
    ↓
pianoAudio.init()  // Inicializa contexto Web Audio
    ↓
POST /api/player/play/Moonlight Sonata
    ↓ (Servidor inicia timer)
connectWebSocket()  // Abre conexión WS
    ↓ (Cada 33ms)
ws.onmessage(data)
    ↓
// Detectar cambios en notas activas:
for (note in data.active) {
    if (!prevActiveNotes.has(note)) {
        pianoAudio.noteOn(note, velocity)  // NUEVA
    }
}
for (note in prevActiveNotes) {
    if (!data.active.includes(note)) {
        pianoAudio.noteOff(note)  // SUELTA
    }
}
prevActiveNotes = data.active

pianoCanvas.update(data)  // Dibuja notas cayendo
```

---

## 🎛 Modos de Operación

### **Karaoke** (Défault)
- Servidor: Reproduce automáticamente todas las notas
- Visualización: Notas caen y suenan en tiempo
- Usuario: Toca junto o solo escucha
- Audio: Todos los velocities se reproducen

### **Learning** (Aprendizaje)
- Servidor: Una nota a la vez (esperando que usuario toque correctamente)
- Visualización: Solo muestra la próxima nota que tocar
- Usuario: Debe tocar la nota correcta en el teclado MIDI
- Validación: Verde si correcto, rojo si incorrecto
- Progresión: Avanza cuando user toca nota correcta

### **Free Play** (Teclado libre)
- No usa MIDI pre-grabado
- Usuario toca directamente teclado MIDI conectado
- LEDs responden a cada nota tocada
- Sin restricciones de timing

---

## 🔧 Problemas Conocidos y Soluciones

### **1. Notas cortadas/sostenidas**
**Síntoma:** Notas que deberían durar 6s se cortan a los 3s.

**Causa raíz:** Oscilador fallback (cuando samples no cargan) tenía `osc.stop(now + 3)`.

**Solución aplicada:**
- ✅ Eliminado límite de 3 segundos
- ✅ Oscilador ahora responde a noteOff como samples
- ✅ Same attack envelope como samples

**Código (línea 268-299 en piano-audio.js):**
```javascript
_oscNoteOn(note, velocity) {
    // ... crear oscilador triangle ...
    // Sin osc.stop() → responde a noteOff
    // Release envelope: 0.15-0.45s según pitch
}
```

---

### **2. Notas con colores incorrectos (todas verdes)**
**Síntoma:** Todas las notas visualizaban como left hand (verde).

**Causa raíz:** MIDI parser asignaba todas las notas a "left".

**Solución aplicada:**
- ✅ Skip empty metadata tracks
- ✅ First non-empty track → right, Second → left
- ✅ Fallback: MIDI >= 60 → right, < 60 → left

---

### **3. Puerto 8001 en lugar de 8000**
**Síntoma:** `http://localhost:8001` no conecta.

**Causa raíz:** INICIAR.bat abría puerto erróneo.

**Solución aplicada:**
- ✅ Actualizado a `localhost:8000`

---

### **4. Caché del navegador no actualiza**
**Síntoma:** Cambios en JS/CSS no aparecen.

**Causa raíz:** Sin versionado de caché.

**Solución:**
- ✅ Todos los scripts: `?v=999`
- ✅ Usuario: Hard refresh `Ctrl+Shift+R`

---

## 📝 Guía Para Futuras Modificaciones

### **Si necesitas cambiar AUDIO:**
1. Editar `pianolearn/static/piano-audio.js`
2. Parámetros principales:
   - `masterGain.gain.value` (línea 19): Volumen general (0-1)
   - Compressor settings (línea 21-26): Dinámica
   - `releaseTime` calculation (línea 241): Duración de resonancia
   - Velocity volume mapping (línea 191): Rango dinámico

3. Test: Reproducir Moonlight Sonata, escuchar notas sostenidas
4. Commit con descripción clara del cambio

### **Si necesitas cambiar VISUALIZACIÓN:**
1. Editar `pianolearn/static/piano-canvas.js`
2. Parámetros principales:
   - `colors` object (línea 10-19): Colores right/left
   - `_drawFallingNotes()` (línea 127-204): Estilo de notas
   - `_drawKeyboard()` (línea 206-334): Estilo del teclado
   - `keyboardRatio` (línea 22): Proporción teclado vs canvas

3. Test: Cargar canción, verificar legibilidad visual
4. Commit con screenshot si cambios visuales

### **Si necesitas cambiar TIMING/REPRODUCCIÓN:**
1. Editar `pianolearn/midi_player.py` o `server.py`
2. Puntos críticos:
   - `get_active_notes()` (línea 14-20): Cuándo nota está "activa"
   - WebSocket send interval (line 212): Frecuencia de actualización
   - Speed multiplier: `scaled_time = elapsed * player.speed`

3. Test: Reproducir mismo MIDI a diferentes velocidades (25%, 100%, 150%)
4. Verificar sincronización visual ↔ audio
5. Commit con notas sobre testing

### **Si necesitas agregar CARACTERÍSTICAS:**
1. ¿Es frontend (visual) o backend (lógica)?
   - **Frontend:** Editar app.js, piano-canvas.js, piano-audio.js
   - **Backend:** Editar server.py, midi_player.py
   
2. ¿Afecta el flujo WebSocket?
   - Si sí: Coordinar cambios en AMBOS lados
   - Si no: Solo modificar lado relevante

3. Test exhaustivamente antes de commit
4. Documentar en comentarios si lógica no es obvia

---

## 🚀 Checklist de Verificación

Antes de considerar "listo":

- [ ] **Audio**: Notas sostenidas suenan completo sin cortes
- [ ] **Audio**: Cambios de velocidad no distorsionan (no clipping)
- [ ] **Audio**: Acordes suenan limpios sin artefactos
- [ ] **Visual**: Notas caen alineadas con audio (sincronización)
- [ ] **Visual**: Colores diferenciados claramente (azul vs verde)
- [ ] **Visual**: Teclado interactivo responde a clics/MIDI
- [ ] **Performance**: 60 FPS en canvas, <100ms latencia audio
- [ ] **MIDI**: Archivos con tracks múltiples se parsean correctamente
- [ ] **Startup**: Un click en INICIAR.bat inicia todo
- [ ] **Cross-browser**: Probado en Chrome, Firefox, Edge

---

## 📞 Notas para Soporte

Si algo falla:

1. **Verificar puerto 8000:**
   ```bash
   netstat -ano | findstr :8000
   ```
   Si está ocupado, matar proceso o cambiar puerto

2. **Verificar logs servidor:**
   ```
   Ventana cmd con servidor → Ver mensajes de error
   ```

3. **Limpiar caché navegador:**
   ```
   Ctrl+Shift+R en la ventana
   ```

4. **Recargar samples:**
   ```
   Esperar 10-30s al abrir por primera vez
   ```

5. **Test de audio básico:**
   ```
   Abrir DevTools (F12) → Console → type:
   pianoAudio.noteOn(60, 100); // Toca Do
   pianoAudio.noteOff(60);     // Suelta
   ```

---

## 📚 Referencias

- **Web Audio API:** https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API
- **FastAPI:** https://fastapi.tiangolo.com/
- **MIDI Soundfonts:** https://gleitz.github.io/midi-js-soundfonts/
- **Canvas 2D:** https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API

---

**Última actualización:** 25 Abril 2026  
**Estado:** Audio fixed (sustained notes), ready for testing  
**Próximo paso:** User verification de audio quality
