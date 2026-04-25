# PianoLearn - Testing Instructions

## Quick Start
1. Open a terminal/command prompt
2. Navigate to the piano-learn folder
3. Run the server:
   ```
   python run_server.py
   ```
4. Open your web browser and go to:
   ```
   http://localhost:8001
   ```

## What to Test

### Visual Test - Color Differentiation
1. Click on any song from the list
2. The player screen should load
3. Click the play button (pause icon) to start playback
4. Watch the **falling notes** at the top of the screen
5. **Expected Result:** You should see TWO DIFFERENT COLORS:
   - **Blue notes** = Right hand (treble)
   - **Green notes** = Left hand (bass)

### Audio Test - Sound Quality
1. Start playing any song
2. **Expected Result:** Music should play clearly without:
   - Distortion or crackling
   - Garbled sound mixing
   - Audio dropouts
3. Notes should fall smoothly corresponding to what you hear

### Animation Test - Note Movement
1. Watch the falling notes as the song plays
2. **Expected Result:**
   - Notes should fall smoothly from top to keyboard
   - No jumping or skipping
   - Notes should reach the keyboard in time with the audio

## Recommended Test Songs
- **"Pokemon - ¡Atrapalo"** - Good mix of both hands
- **"River Flows in You - Yiruma"** - More complex piece
- **"Ode to Joy - Beethoven"** - Simple to verify colors clearly

## If Something Goes Wrong

### No colors showing (all green)
- This should be fixed now, but if you see it:
  - Stop the server (Ctrl+C)
  - Delete folder: `pianolearn/__pycache__`
  - Restart the server

### Audio distorted/crackling
- Make sure you're using the latest version from git
- Check that no other programs are using the audio device
- Try a different MIDI file

### Port 8001 already in use
- Change port in `run_server.py` line 3
- Use a different port like 8002, 8003, etc.

## Success Criteria
✓ Colors clearly differentiated (blue ≠ green)
✓ Audio plays without distortion
✓ Notes fall smoothly
✓ Application is responsive
