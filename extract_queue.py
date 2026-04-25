import requests
import time
import sys

API = "http://localhost:8000"

songs = [
    # Principiante
    ("Twinkle Twinkle Little Star", "https://www.youtube.com/watch?v=CNJTJuaxVAw", True),
    ("Ode to Joy - Beethoven", "https://www.youtube.com/watch?v=AbXiKLA58SE", True),
    ("Fur Elise - Beethoven", "https://www.youtube.com/watch?v=o0VwTw1eZ1k", True),
    ("Prelude in C Major BWV 846 - Bach", "https://www.youtube.com/watch?v=frxT2qB1POQ", True),
    ("Comptine d'un autre ete - Yann Tiersen", "https://www.youtube.com/watch?v=NvryolGa19A", True),
    ("River Flows in You - Yiruma", "https://www.youtube.com/watch?v=7maJOI3QMu0", True),
    # Intermedio
    ("Gymnopedie No 1 - Erik Satie", "https://www.youtube.com/watch?v=S-Xm7s9eGxU", True),
    ("Nocturne Op 9 No 2 - Chopin", "https://www.youtube.com/watch?v=9E6b3swbnWg", True),
    # Avanzado
    ("Fantaisie Impromptu - Chopin", "https://www.youtube.com/watch?v=Gus4dnQuiGk", True),
    ("La Campanella - Liszt", "https://www.youtube.com/watch?v=H1Dvg2MxQn8", True),
]

for i, (name, url, separate) in enumerate(songs):
    print(f"\n[{i+1}/{len(songs)}] Extrayendo: {name}")
    print(f"  URL: {url}")
    
    # Start extraction
    r = requests.post(f"{API}/api/extract", json={"url": url, "name": name, "separate": separate})
    data = r.json()
    
    if "error" in data:
        print(f"  ERROR: {data['error']}")
        # Wait for current one to finish
        print("  Esperando que termine la extraccion actual...")
        time.sleep(30)
        continue
    
    job_id = data["job_id"]
    print(f"  Job: {job_id}")
    
    # Poll until done
    while True:
        time.sleep(5)
        r = requests.get(f"{API}/api/extract/status/{job_id}")
        st = r.json()
        status = st.get("status", "?")
        progress = st.get("progress", "")
        print(f"  [{status}] {progress}")
        
        if status in ("done", "error"):
            break
    
    if status == "done":
        print(f"  OK: {name}")
    else:
        print(f"  FALLO: {name}")

print("\n=== LISTO ===")
