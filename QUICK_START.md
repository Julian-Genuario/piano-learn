# PianoLearn - Guía Rápida

## ⚡ Inicio Rápido

```bash
# Opción 1: Punto y click
Double-click INICIAR.bat

# Opción 2: Línea de comando
cd C:\Users\Juli\Desktop\piano-learn
python run_server.py --mock
# Luego abrir: http://localhost:8000
```

## 📍 Ubicación del Proyecto
```
C:\Users\Juli\Desktop\piano-learn
```

---

## 🔑 Archivos Críticos (Los que probablemente necesites editar)

| Archivo | Qué Hace | Cuándo Editar |
|---------|----------|---------------|
| `pianolearn/static/piano-audio.js` | **Audio** (síntesis, volume, compressor) | Problema con sonido |
| `pianolearn/static/piano-canvas.js` | **Visualización** (notas cayendo, teclado) | Problema con gráficos |
| `pianolearn/static/app.js` | **Lógica** (control, WebSocket) | Problema con flujo |
| `pianolearn/server.py` | **Backend** (timing, endpoints) | Problema con reproducción |
| `pianolearn/midi_parser.py` | **MIDI parsing** (detección manos) | MIDI no se parsea bien |

---

## 🎛 Configuración Importante

### Audio (piano-audio.js, línea 14-40)
```javascript
this.masterGain.gain.value = 0.6;           // Volumen principal [0-1]
this.compressor.threshold.value = -15;      // Threshold compresión [dB]
this.compressor.ratio.value = 1.5;          // Agresividad compresión
const releaseTime = 0.15 + (72-note)/60*0.25; // Duración resonancia [s]
const vol = velNorm * 0.65 + 0.10;          // Volumen por velocity [0.1-0.75]
```

### Colores (piano-canvas.js, línea 10-19)
```javascript
right: '#1E90FF',    // Azul Synthesia
left: '#00C853',     // Verde
```

### Timing (server.py, línea 212)
```python
await asyncio.sleep(0.033)  # 30 FPS - NO CAMBIAR sin motivo
```

---

## 🐛 Problemas Comunes

### "Notas se escuchan cortadas"
- ✅ Solución: `piano-audio.js` línea 268-299 (oscilador fallback sin límite de 3s)
- Verificar: `releaseTime` no sea muy corto

### "Todo es verde, sin diferencias de color"
- ✅ Solución: `midi_parser.py` línea 67-80 (detección de mano)
- Test: Reproducir archivo con dos tracks separados

### "Notas desincronizadas"
- Verificar: WebSocket se envía cada 33ms (línea 212 server.py)
- Verificar: `scaled_time` vs `elapsed` en server.py línea 186-208

### "Navegador no ve cambios de código"
- Solución: `Ctrl+Shift+R` en navegador (hard refresh)
- Script version: `?v=999` en todos los scripts

### "Puerto 8000 en uso"
```bash
# Matar proceso
taskkill /F /IM python.exe

# O cambiar puerto en run_server.py línea 13
uvicorn.run(app, host="0.0.0.0", port=8001)
```

---

## 🧪 Testing Rápido

**Canción para test (muchas notas sostenidas):**
```
songs/Beethoven - Moonlight Sonata 1st Movement.mid
```

**Verificar en consola (F12):**
```javascript
// Reproducir una nota
pianoAudio.noteOn(60, 100);   // Do, velocity 100
setTimeout(() => pianoAudio.noteOff(60), 2000);  // Suelta en 2s

// Ver si los samples cargaron
pianoAudio.loaded        // true/false
pianoAudio._loadProgress // 0.0 a 1.0 (porcentaje)

// Ver estado del servidor
fetch('/api/player/state').then(r => r.json()).then(console.log);
```

---

## 📋 Checklist Antes de Considerar "Listo"

- [ ] Reproducir canción → notas no se cortan
- [ ] Cambiar velocidad (25%, 100%, 150%) → sin distorsión
- [ ] Tocar acordes (múltiples notas) → sin artefactos
- [ ] Verificar sincronización visual ↔ audio
- [ ] Hard refresh navegador (`Ctrl+Shift+R`)
- [ ] Cerrar y abrir de nuevo (test de startup limpio)

---

## 📁 Estructura Carpeta

```
piano-learn/
├── INICIAR.bat               ← EJECUTAR ESTO
├── PROYECTO.md               ← Plan completo (lee esto primero)
├── QUICK_START.md            ← Estás aquí
├── run_server.py
├── pianolearn/
│   ├── server.py             ← Endpoints, WebSocket, timing
│   ├── midi_parser.py        ← Parse MIDI, detección manos
│   ├── midi_player.py        ← Reproductor con timing
│   ├── led_controller.py
│   ├── midi_input.py
│   ├── song_library.py
│   └── static/
│       ├── index.html        ← Página principal
│       ├── styles.css
│       ├── piano-audio.js    ← Audio (CRÍTICO)
│       ├── piano-canvas.js   ← Visualización (CRÍTICO)
│       └── app.js            ← Control (CRÍTICO)
└── songs/                    ← Archivos MIDI aquí
    ├── Moonlight Sonata...
    ├── Canon D...
    └── (más canciones)
```

---

## 🔗 WebSocket Flow

**Cliente → Servidor:**
```
POST /api/player/play/CANCIÓN
    ↓ Servidor inicia timer
    ↓
POST /api/player/speed/1.0
    ↓
ws://localhost:8000/ws/player
```

**Servidor → Cliente (cada 33ms):**
```json
{
  "active": [
    {"note": 60, "hand": "right", "velocity": 100},
    {"note": 48, "hand": "left", "velocity": 80}
  ],
  "upcoming": [
    {"note": 62, "hand": "right", "start": 0.5, "duration": 1.2}
  ],
  "elapsed": 2.34,
  "mode": "karaoke"
}
```

**Cliente:**
```
noteOn(60, 100)   // Nueva nota en active
noteOff(60)       // Nota desapareció de active
canvas.update()   // Redibuja notas
```

---

## 🛠 Comandos Útiles

```bash
# Ver qué Python tienes
python --version

# Ver si puerto 8000 está libre
netstat -ano | findstr :8000

# Instalar dependencias
pip install fastapi uvicorn mido

# Limpiar procesos Python
taskkill /F /IM python.exe

# Ver logs en tiempo real
tail -f logs.txt
```

---

## 💡 Tips

1. **Siempre versionar cambios:** El navegador cachea agresivamente
   - Cambiar `?v=999` a `?v=1000` en scripts

2. **Usar DevTools:** `F12` → Console para debugging en vivo
   - Ver errores
   - Test código interactivo
   - Ver tráfico WebSocket

3. **Documentar cambios:** En comentarios código si no es obvio

4. **Test incremental:** Un cambio a la vez, test rápido después

5. **Usar Moonlight Sonata para test:** Tiene muchas notas sostenidas

---

## 📞 Si nada funciona

1. **Restart completo:**
   ```bash
   Cerrar navegador
   Cerrar cmd del servidor
   Matar python.exe (taskkill /F /IM python.exe)
   Ejecutar INICIAR.bat de nuevo
   ```

2. **Limpiar todo:**
   ```bash
   Eliminar __pycache__ (carpeta)
   Vaciar caché navegador (Ctrl+Shift+Del)
   Hard refresh (Ctrl+Shift+R)
   ```

3. **Revisar logs:**
   ```
   Ver ventana cmd → buscar errores rojo
   F12 Console en navegador → errores JS
   ```

---

**Próxima vez que trabajes en esto, lee:**
1. Este archivo (QUICK_START.md)
2. PROYECTO.md (para contexto completo)
3. Los comentarios en el archivo que necesites editar
