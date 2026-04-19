"""Start MIDI Extractor web UI."""
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

import uvicorn
from midi_extractor.web import app

uvicorn.run(app, host="0.0.0.0", port=8001)
