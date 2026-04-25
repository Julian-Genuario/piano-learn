#!/usr/bin/env python3
"""
Debug script to verify colors are working correctly
"""
import json
from pianolearn.midi_parser import parse_midi
from pianolearn.midi_player import MidiPlayer

print("=" * 70)
print("DEBUG: Verificando flujo de colores")
print("=" * 70)

# Test 1: Parse MIDI
print("\n1. PARSING MIDI FILE")
print("-" * 70)

song = "songs/Pokemon - ¡Atrapalo.mid"
events = parse_midi(song)

print(f"Canción: {song}")
print(f"Total de notas: {len(events)}")

right_notes = [e for e in events if e.hand == 'right']
left_notes = [e for e in events if e.hand == 'left']

print(f"Mano derecha: {len(right_notes)} notas")
print(f"Mano izquierda: {len(left_notes)} notas")

if len(right_notes) == 0:
    print("ERROR: NO HAY NOTAS DERECHA!")
    print("Mostrando todas las notas:")
    for i, e in enumerate(events[:10]):
        print(f"  {i}: Nota {e.note}, hand='{e.hand}'")
    exit(1)

print("\nPrimeras 5 notas derecha:")
for e in right_notes[:5]:
    print(f"  Nota {e.note}: hand='{e.hand}' (start={e.start_time:.2f}s)")

print("\nPrimeras 5 notas izquierda:")
for e in left_notes[:5]:
    print(f"  Nota {e.note}: hand='{e.hand}' (start={e.start_time:.2f}s)")

# Test 2: Player
print("\n2. PLAYER (Simulando WebSocket)")
print("-" * 70)

player = MidiPlayer(events=events, mode='karaoke', speed=1.0)

# Simular varios puntos de tiempo
test_times = [0.0, 2.0, 4.0, 6.0]

for current_time in test_times:
    active = player.get_active_notes(current_time=current_time)
    upcoming = player.get_upcoming_notes(current_time=current_time, window=3.0)

    print(f"\nTiempo {current_time}s:")
    print(f"  Activas: {len(active)} notas")
    print(f"  Próximas: {len(upcoming)} notas")

    if upcoming:
        print(f"  Primeras 3 próximas:")
        for note in upcoming[:3]:
            print(f"    Nota {note.note}: hand='{note.hand}' (start={note.start_time:.2f}s)")

        # Contar manos en upcoming
        right_upcoming = sum(1 for n in upcoming if n.hand == 'right')
        left_upcoming = sum(1 for n in upcoming if n.hand == 'left')
        print(f"  Distribución: {right_upcoming} derecha, {left_upcoming} izquierda")

        if left_upcoming == len(upcoming):
            print("  ERROR: TODAS LAS NOTAS SON IZQUIERDA!")

# Test 3: JSON que se enviaría
print("\n3. DATOS QUE SE ENVIARIAN POR WEBSOCKET")
print("-" * 70)

current_time = 3.0
active = player.get_active_notes(current_time=current_time)
upcoming = player.get_upcoming_notes(current_time=current_time, window=3.0)

data = {
    "active": [{"note": n.note, "hand": n.hand, "velocity": n.velocity} for n in active],
    "upcoming": [
        {"note": n.note, "hand": n.hand, "start": n.start_time, "duration": n.duration}
        for n in upcoming
    ],
    "elapsed": current_time,
    "mode": "karaoke"
}

print(json.dumps(data, indent=2)[:500])

# Verificar
print("\n4. VERIFICACION FINAL")
print("-" * 70)

all_ok = True

if len(right_notes) == 0:
    print("ERROR: Parser no está retornando notas derecha")
    all_ok = False
else:
    print("✓ Parser retorna notas derecha")

if len(left_notes) == 0:
    print("ERROR: Parser no está retornando notas izquierda")
    all_ok = False
else:
    print("✓ Parser retorna notas izquierda")

# Check upcoming in test
upcoming_right = sum(1 for n in upcoming if n.hand == 'right')
upcoming_left = sum(1 for n in upcoming if n.hand == 'left')

if upcoming_right == 0 and upcoming_left > 0:
    print("ERROR: Notas próximas solo tienen 'left', ninguna 'right'")
    all_ok = False
elif upcoming_right > 0 and upcoming_left > 0:
    print(f"✓ Notas próximas tiene mix: {upcoming_right} derecha, {upcoming_left} izquierda")
elif upcoming_right > 0:
    print(f"✓ Notas próximas tiene derecha")

if all_ok:
    print("\n✅ TODO PARECE ESTAR BIEN EN EL SERVIDOR")
    print("El problema está en el navegador o JavaScript")
else:
    print("\n❌ HAY UN PROBLEMA EN EL SERVIDOR")

print("\n" + "=" * 70)
