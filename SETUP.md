# Guía Rápida de Setup

## 🖥️ Windows - PC

### Opción A: VBS Scripts (más fácil)
1. **Descomprime** `piano-learn` en una carpeta
2. **Instala Python** desde python.org (versión 3.10-3.13)
3. **Abre PowerShell en la carpeta** y ejecuta:
   ```powershell
   python -m venv .venv
   .\.venv\Scripts\activate
   pip install -r requirements-pc.txt
   ```
4. **Haz doble click en:**
   - `start_pianolearn.vbs` → Piano (http://localhost:8000)
   - `start_extractor.vbs` → MIDI Extractor (http://localhost:8001)

### Opción B: Línea de comandos
```powershell
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements-pc.txt
python run_server.py --mock
```
Luego abre http://localhost:8000 en navegador.

---

## 🍓 Raspberry Pi

### Setup inicial (solo una vez)

1. **SSH a la Pi:**
   ```bash
   ssh pi@pianolearn.local
   # O: ssh pi@192.168.x.x (reemplaza con tu IP)
   ```

2. **Copia la carpeta:**
   ```bash
   # Desde tu PC (en PowerShell/bash):
   scp -r ./piano-learn pi@pianolearn.local:~/
   ```
   O simplemente copia los archivos manualmente.

3. **En la Pi, instala dependencias:**
   ```bash
   cd piano-learn
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements-pi.txt
   ```

4. **Si usas LEDs WS2812B:**
   ```bash
   sudo usermod -a -G gpio pi
   sudo reboot
   ```

### Ejecutar

**Opción A: Una sola vez (testing)**
```bash
source .venv/bin/activate
python run_server.py
```
Accede desde tablet: http://pianolearn.local:8000

**Opción B: Como servicio (auto-start)**
```bash
sudo cp deploy.sh /usr/local/bin/pianolearn
sudo chmod +x /usr/local/bin/pianolearn
sudo systemctl enable pianolearn
sudo systemctl start pianolearn
```

Ver logs:
```bash
sudo journalctl -u pianolearn -f
```

---

## 🎹 Uso Básico

1. **Selecciona perfil** (o crea uno nuevo)
2. **Carga MIDI:**
   - Botón **MIDI** → Sube archivo `.mid`
   - Botón **YouTube** → Pega URL (extrae automáticamente)
3. **Toca una canción:**
   - Click en la canción → Espera a que cargue
   - Presiona **▶** cuando estés listo
   - Las notas caen: **AZUL** = izquierda, **VERDE** = derecha
4. **Ajusta:**
   - **Velocidad:** Slider 25%-150%
   - **Volumen:** Slider
   - **Colores:** Ajustes → Elije colores

---

## 🔧 Problemas Comunes

### "No module named 'anthropic'" / ImportError
**Solución:** Reinstala requirements
```bash
pip install --upgrade -r requirements-pc.txt  # PC
pip install --upgrade -r requirements-pi.txt  # Pi
```

### Servidor no inicia / Puerto 8000 ocupado
```bash
# Windows: Mata proceso en puerto 8000
netstat -ano | findstr :8000
taskkill /PID <PID> /F

# Linux/Pi: 
sudo lsof -i :8000
sudo kill -9 <PID>
```

### LEDs no encienden en Pi
1. Verifica GPIO 18 conectado al pin DIN del strip
2. Prueba con script simple:
   ```bash
   python3 -c "from rpi_ws281x import Adafruit_NeoPixel; print('OK')"
   ```
3. Revisa permisos: `groups pi` debe incluir `gpio`

### Notas se ven todas del mismo color
- Limpia caché navegador: **Ctrl+Shift+Delete**
- O abre en **navegación privada / incognito**

### Extractor MIDI lento
- Limpia carpeta `separated/` si ocupa >1GB
- Aumenta RAM o reduce batch size en `extract_batch*.py`

---

## 📱 Acceso desde Tablet

### Misma red (WiFi)
- **URL:** `http://pianolearn.local:8000`
- O si no funciona: `http://192.168.x.x:8000` (reemplaza IP)
- Tablet debe estar en **misma WiFi** que Pi

### Diferentes redes / Internet
- Usa **ngrok** o **CloudFlare Tunnel**
- Fuera del scope de este setup básico

---

## 🎯 Checklist antes de empezar

- [ ] Python 3.10-3.13 instalado (NO 3.14)
- [ ] Carpeta `piano-learn` descomprimida
- [ ] `requirements-*.txt` presente
- [ ] MIDI teclado USB conectado (opcional pero recomendado)
- [ ] LEDs WS2812B en GPIO 18 de Pi (si aplica)
- [ ] Navegador actualizado (Chrome/Safari/Firefox)

---

¿Preguntas? Revisa **README.md** para detalle completo.
