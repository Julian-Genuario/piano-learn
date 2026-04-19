"""Start PianoLearn server in mock mode (no LEDs)."""
import sys
import os

# Add project root to path
sys.path.insert(0, os.path.dirname(__file__))

import uvicorn
from pianolearn.server import create_app

mock = "--mock" in sys.argv
app = create_app(mock_leds=mock)
uvicorn.run(app, host="0.0.0.0", port=8000)
