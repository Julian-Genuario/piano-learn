import uuid
import threading
import time
import traceback
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
_current_job: str | None = None


class ExtractRequest(BaseModel):
    url: str
    name: str | None = None
    separate: bool = False
    pi_host: str = "pianolearn.local"


def extract_midi_background(job_id: str, req: ExtractRequest):
    """Run extraction in background thread, updating job status."""
    global _current_job
    try:
        def on_progress(msg: str):
            jobs[job_id]["progress"] = msg
            jobs[job_id]["updated"] = time.time()

        jobs[job_id] = {"status": "running", "progress": "Descargando audio...", "updated": time.time()}

        midi_path = extract_midi(
            url=req.url,
            name=req.name,
            separate=req.separate,
            on_progress=on_progress
        )

        on_progress("Enviando a Pi...")
        synced = send_to_pi(midi_path, pi_host=req.pi_host)

        jobs[job_id] = {
            "status": "done",
            "progress": "Listo!",
            "midi_path": midi_path,
            "synced": synced
        }
    except Exception as e:
        jobs[job_id] = {
            "status": "error",
            "progress": f"{type(e).__name__}: {e}"
        }
        traceback.print_exc()
    finally:
        _current_job = None


@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    return templates.TemplateResponse(request, "index.html")


@app.post("/extract")
async def extract(req: ExtractRequest):
    global _current_job

    # Check if there's a stuck job (no update in 5 minutes)
    if _current_job and _current_job in jobs:
        job = jobs[_current_job]
        if job.get("status") == "running":
            elapsed = time.time() - job.get("updated", 0)
            if elapsed > 300:
                jobs[_current_job] = {"status": "error", "progress": "Timeout: la extraccion tardo mas de 5 minutos"}
                _current_job = None

    if _current_job is not None:
        return {"error": "Ya hay una extraccion en curso. Espera a que termine."}

    job_id = uuid.uuid4().hex[:8]
    _current_job = job_id
    thread = threading.Thread(target=extract_midi_background, args=(job_id, req), daemon=True)
    thread.start()
    return {"job_id": job_id}


@app.get("/status/{job_id}")
async def status(job_id: str):
    if job_id not in jobs:
        return {"status": "not_found"}
    return jobs[job_id]
