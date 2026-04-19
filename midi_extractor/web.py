import uuid
import threading
from fastapi import FastAPI
from fastapi.requests import Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel

from midi_extractor.pipeline import extract_midi
from midi_extractor.sync_client import send_to_pi

app = FastAPI(title="PianoLearn MIDI Extractor")
templates = Jinja2Templates(directory="midi_extractor/templates")

jobs: dict[str, dict] = {}
_extracting = threading.Lock()


class ExtractRequest(BaseModel):
    url: str
    name: str | None = None
    separate: bool = False
    pi_host: str = "pianolearn.local"


def extract_midi_background(job_id: str, req: ExtractRequest):
    """Run extraction in background thread, updating job status."""
    if not _extracting.acquire(blocking=False):
        jobs[job_id] = {"status": "error", "progress": "Ya hay una extraccion en curso. Espera a que termine."}
        return
    try:
        def on_progress(msg: str):
            jobs[job_id]["progress"] = msg

        jobs[job_id] = {"status": "running", "progress": "Starting..."}

        midi_path = extract_midi(
            url=req.url,
            name=req.name,
            separate=req.separate,
            on_progress=on_progress
        )

        on_progress("Syncing to Pi...")
        synced = send_to_pi(midi_path, pi_host=req.pi_host)

        jobs[job_id] = {
            "status": "done",
            "progress": "Complete!",
            "midi_path": midi_path,
            "synced": synced
        }
    except Exception as e:
        jobs[job_id] = {"status": "error", "progress": str(e)}
    finally:
        _extracting.release()


@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    return templates.TemplateResponse(request, "index.html")


@app.post("/extract")
async def extract(req: ExtractRequest):
    job_id = uuid.uuid4().hex[:8]
    thread = threading.Thread(target=extract_midi_background, args=(job_id, req))
    thread.start()
    return {"job_id": job_id}


@app.get("/status/{job_id}")
async def status(job_id: str):
    if job_id not in jobs:
        return {"status": "not_found"}
    return jobs[job_id]
