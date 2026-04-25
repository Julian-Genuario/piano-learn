import asyncio
import time
import os
import sys

from fastapi import FastAPI, UploadFile, File, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel

from pianolearn.song_library import SongLibrary
from pianolearn.led_controller import LEDController
from pianolearn.midi_parser import parse_midi
from pianolearn.midi_player import MidiPlayer


class BrightnessRequest(BaseModel):
    brightness: int


class ColorsRequest(BaseModel):
    right: list[int]
    left: list[int]


class SpeedRequest(BaseModel):
    speed: float


class ModeRequest(BaseModel):
    mode: str


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

    # --- Song endpoints ---

    @app.get("/api/songs")
    async def list_songs():
        return library.list_songs()

    @app.get("/api/songs/{name}")
    async def get_song(name: str):
        song = library.get_song(name)
        if not song:
            return {"error": "not found"}
        return song

    @app.post("/api/songs/upload")
    async def upload_song(file: UploadFile = File(...)):
        data = await file.read()
        library.save_song(file.filename, data)
        return {"status": "ok", "filename": file.filename}

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

        events = parse_midi(path)
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
                        active = player.get_active_notes(scaled_time)
                        upcoming = player.get_upcoming_notes(scaled_time, window=3.0)
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
