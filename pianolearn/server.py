import asyncio
import time
import os
import sys
import uuid
import threading
import traceback

from fastapi import FastAPI, UploadFile, File, WebSocket, WebSocketDisconnect, Body
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel

from pianolearn.song_library import SongLibrary
from pianolearn.led_controller import LEDController
from pianolearn.midi_parser import parse_midi
from pianolearn.midi_player import MidiPlayer

try:
    from midi_extractor.pipeline import extract_midi
except ImportError:
    extract_midi = None


class BrightnessRequest(BaseModel):
    brightness: int


class ColorsRequest(BaseModel):
    right: list[int]
    left: list[int]


class SpeedRequest(BaseModel):
    speed: float


class ModeRequest(BaseModel):
    mode: str


class YouTubeUrlRequest(BaseModel):
    url: str


class ExtractYouTubeRequest(BaseModel):
    url: str
    name: str | None = None
    separate: bool = False


def create_app(songs_dir: str = "songs", mock_leds: bool = False) -> FastAPI:
    app = FastAPI(title="PianoLearn")

    library = SongLibrary(songs_dir=songs_dir)
    leds = LEDController(mock=mock_leds)

    state = {
        "playing": False,
        "current_song": None,
        "mode": "karaoke",
        "speed": 1.0,
        "player": None,
        "start_time": 0.0,
        "colors": {"right": [0, 100, 255], "left": [0, 255, 100]},
    }

    # YouTube extraction job tracking
    extract_jobs: dict[str, dict] = {}
    current_extract_job: str | None = None

    def extract_midi_background(job_id: str, req: ExtractYouTubeRequest):
        """Run extraction in background thread."""
        nonlocal current_extract_job
        try:
            def on_progress(msg: str):
                extract_jobs[job_id]["progress"] = msg
                extract_jobs[job_id]["updated"] = time.time()

            extract_jobs[job_id] = {"status": "running", "progress": "Iniciando...", "updated": time.time()}

            midi_path = extract_midi(
                url=req.url,
                name=req.name,
                separate=req.separate,
                output_dir=songs_dir,
                on_progress=on_progress
            )

            extract_jobs[job_id] = {
                "status": "done",
                "progress": "Listo!",
                "midi_path": midi_path,
                "updated": time.time()
            }
        except Exception as e:
            extract_jobs[job_id] = {
                "status": "error",
                "progress": f"{type(e).__name__}: {str(e)}",
                "updated": time.time()
            }
            traceback.print_exc()
        finally:
            current_extract_job = None

    # --- Song endpoints ---

    @app.get("/api/songs")
    async def list_songs():
        return library.list_songs()

    @app.post("/api/songs/upload")
    async def upload_song(file: UploadFile = File(...)):
        data = await file.read()
        library.save_song(file.filename, data)
        return {"status": "ok", "filename": file.filename}

    @app.post("/api/songs-title")
    async def get_youtube_title(req: YouTubeUrlRequest):
        """Get just the title from a YouTube URL without extracting MIDI."""
        try:
            from midi_extractor.downloader import download_audio
            # We need to download to get the title, but delete the audio after
            wav_path, title = download_audio(req.url, output_dir=songs_dir)
            import os
            if os.path.exists(wav_path):
                os.remove(wav_path)
            return {"title": title}
        except Exception as e:
            return {"error": str(e)}

    @app.post("/api/songs/extract-youtube")
    async def extract_youtube(req: ExtractYouTubeRequest):
        nonlocal current_extract_job

        if not extract_midi:
            return {"error": "MIDI extractor not installed. Install with: pip install yt-dlp demucs basic-pitch"}

        # Check if extraction is already running
        if current_extract_job and current_extract_job in extract_jobs:
            job = extract_jobs[current_extract_job]
            if job.get("status") == "running":
                elapsed = time.time() - job.get("updated", 0)
                if elapsed > 1800:  # 30 minute timeout
                    extract_jobs[current_extract_job] = {
                        "status": "error",
                        "progress": "Timeout: la extraccion tardo mas de 30 minutos",
                        "updated": time.time()
                    }
                    current_extract_job = None
                else:
                    return {"error": "Ya hay una extraccion en curso. Espera a que termine."}

        job_id = uuid.uuid4().hex[:8]
        current_extract_job = job_id
        thread = threading.Thread(target=extract_midi_background, args=(job_id, req), daemon=True)
        thread.start()
        return {"job_id": job_id}

    @app.get("/api/songs/extract-status/{job_id}")
    async def extract_status(job_id: str):
        if job_id not in extract_jobs:
            return {"status": "not_found"}
        return extract_jobs[job_id]

    @app.get("/api/songs/{name}")
    async def get_song(name: str):
        song = library.get_song(name)
        if not song:
            return {"error": "not found"}
        return song

    @app.delete("/api/songs/{name}")
    async def delete_song(name: str):
        library.delete_song(name)
        return {"status": "ok"}

    # --- Player endpoints ---

    @app.post("/api/player/play/{song_name}")
    async def play_song(song_name: str):
        path = library.get_song_path(song_name)
        if not path:
            return {"error": "song not found"}

        try:
            events = parse_midi(path)
        except OSError as e:
            return {"error": f"Invalid MIDI file: {str(e)}"}
        except Exception as e:
            return {"error": f"Failed to load song: {str(e)}"}

        state["player"] = MidiPlayer(events=events, mode=state["mode"], speed=state["speed"])
        state["playing"] = True
        state["current_song"] = song_name
        state["start_time"] = time.time()
        return {"status": "playing", "song": song_name}

    @app.post("/api/player/pause")
    async def pause():
        state["playing"] = not state["playing"]
        return {"playing": state["playing"]}

    @app.post("/api/player/stop")
    async def stop():
        state["playing"] = False
        state["current_song"] = None
        state["player"] = None
        leds.clear_all()
        return {"status": "stopped"}

    @app.post("/api/player/speed")
    async def set_speed(req: SpeedRequest):
        state["speed"] = req.speed
        if state["player"]:
            state["player"].speed = req.speed
        return {"speed": state["speed"]}

    @app.post("/api/player/mode")
    async def set_mode(req: ModeRequest):
        state["mode"] = req.mode
        return {"mode": state["mode"]}

    @app.get("/api/player/state")
    async def player_state():
        return {
            "playing": state["playing"],
            "current_song": state["current_song"],
            "mode": state["mode"],
            "speed": state["speed"],
            "colors": state["colors"]
        }

    # --- LED endpoints ---

    @app.post("/api/leds/brightness")
    async def set_brightness(req: BrightnessRequest):
        leds.set_brightness(req.brightness)
        return {"brightness": req.brightness}

    @app.post("/api/leds/colors")
    async def set_colors(req: ColorsRequest):
        state["colors"]["right"] = req.right
        state["colors"]["left"] = req.left
        return {"colors": state["colors"]}

    @app.get("/api/leds/status")
    async def led_status():
        return {"brightness": leds.brightness, "num_leds": leds.num_leds}

    # --- MIDI Input ---

    midi_in = None

    def on_piano_note(note: int, velocity: int, is_on: bool):
        colors = state["colors"]
        if is_on:
            hand = "right" if note >= 60 else "left"
            color = tuple(colors["right"]) if hand == "right" else tuple(colors["left"])

            if state["mode"] == "learning" and state["player"]:
                if state["player"].is_correct_note(note):
                    state["player"].note_played(note)
                else:
                    color = (255, 0, 0)

            leds.set_note(note, color)
        else:
            leds.clear_note(note)

    @app.get("/api/midi/ports")
    async def list_midi_ports():
        from pianolearn.midi_input import MidiInput
        return {"ports": MidiInput.list_ports()}

    @app.post("/api/midi/connect/{port_name}")
    async def connect_midi(port_name: str):
        nonlocal midi_in
        from pianolearn.midi_input import MidiInput
        if midi_in:
            midi_in.stop()
        midi_in = MidiInput(on_note=on_piano_note, mock=mock_leds)
        midi_in.start(port_name)
        return {"status": "connected", "port": port_name}

    # --- WebSocket ---

    @app.websocket("/ws/player")
    async def ws_player(ws: WebSocket):
        await ws.accept()
        try:
            while True:
                if state["playing"] and state["player"]:
                    elapsed = time.time() - state["start_time"]
                    player = state["player"]
                    scaled_time = elapsed * player.speed

                    if state["mode"] == "karaoke":
                        active = player.get_active_notes(elapsed)
                        upcoming = player.get_upcoming_notes(elapsed, window=3.0)
                    else:
                        active = player.get_waiting_notes()
                        upcoming = active

                    leds.clear_all()
                    colors = state["colors"]
                    for note_ev in active:
                        color = tuple(colors["right"]) if note_ev.hand == "right" else tuple(colors["left"])
                        leds.set_note(note_ev.note, color)

                    await ws.send_json({
                        "active": [{"note": n.note, "hand": n.hand, "velocity": n.velocity} for n in active],
                        "upcoming": [
                            {"note": n.note, "hand": n.hand, "start": n.start_time,
                             "duration": n.duration}
                            for n in upcoming
                        ],
                        "elapsed": scaled_time,
                        "mode": state["mode"]
                    })

                await asyncio.sleep(0.033)  # ~30fps
        except WebSocketDisconnect:
            pass

    # --- Static files ---
    # Mount at /static to avoid capturing WebSocket and API routes
    static_dir = os.path.join(os.path.dirname(__file__), "static")
    if os.path.exists(static_dir):
        app.mount("/static", StaticFiles(directory=static_dir), name="static")

        @app.get("/")
        async def serve_index():
            return FileResponse(os.path.join(static_dir, "index.html"))

    return app


if __name__ == "__main__":
    import uvicorn
    mock = "--mock" in sys.argv
    app = create_app(mock_leds=mock)
    uvicorn.run(app, host="0.0.0.0", port=8000)
