import urllib.request, json, time

API = "http://localhost:8000"

songs = [
    # Principiante
    ("John Legend - All of Me Piano", "https://www.youtube.com/watch?v=PaKr9gWqwl4"),
    ("Yann Tiersen - La Valse d'Amelie", "https://www.youtube.com/watch?v=H2-1u8xvk54"),
    ("Pachelbel - Canon in D Piano", "https://www.youtube.com/watch?v=NlprozGcs80"),
    # Intermedio
    ("Schubert - Serenade", "https://www.youtube.com/watch?v=Kqsm8d0LQEQ"),
    ("Mozart - Sonata No 16 in C Major", "https://www.youtube.com/watch?v=qfFqsolFnEk"),
    ("Beethoven - Pathetique Sonata 2nd Movement", "https://www.youtube.com/watch?v=SrcOcKYQX3c"),
    # Avanzado
    ("Chopin - Revolutionary Etude", "https://www.youtube.com/watch?v=g1uLrHq9TDg"),
    ("Debussy - Arabesque No 1", "https://www.youtube.com/watch?v=Yh36PaE-Pf0"),
    ("Liszt - Hungarian Rhapsody No 2", "https://www.youtube.com/watch?v=ALqOj3NuL4c"),
]

for i, (name, url) in enumerate(songs):
    print(f"\n[{i+1}/{len(songs)}] {name}", flush=True)
    
    data = json.dumps({"url": url, "name": name, "separate": True}).encode()
    req = urllib.request.Request(f"{API}/api/extract", data=data, headers={"Content-Type": "application/json"})
    try:
        resp = urllib.request.urlopen(req)
        result = json.loads(resp.read())
    except Exception as e:
        print(f"  ERROR connecting: {e}", flush=True)
        continue
    
    if "error" in result:
        print(f"  ERROR: {result['error']}", flush=True)
        time.sleep(30)
        continue
    
    job_id = result["job_id"]
    while True:
        time.sleep(10)
        try:
            resp = urllib.request.urlopen(f"{API}/api/extract/status/{job_id}")
            st = json.loads(resp.read())
        except:
            continue
        status = st.get("status", "?")
        progress = st.get("progress", "")
        print(f"  [{status}] {progress}", flush=True)
        if status in ("done", "error"):
            break

print("\n=== BATCH 2 DONE ===", flush=True)
