import urllib.request, json, time

API = "http://localhost:8000"

songs = [
    # Clasicos populares
    ("Chopin - Raindrop Prelude Op 28 No 15", "https://www.youtube.com/watch?v=6OFHXmiZP38"),
    ("Bach - Prelude in C Minor BWV 999", "https://www.youtube.com/watch?v=PXMVkQ70I88"),
    ("Satie - Gnossienne No 1", "https://www.youtube.com/watch?v=PLFVGwGQcB0"),
    ("Mozart - Rondo Alla Turca", "https://www.youtube.com/watch?v=quxTnEEETbo"),
    ("Beethoven - Tempest Sonata 3rd Movement", "https://www.youtube.com/watch?v=0DYBOmLIkbk"),
    # Modernos / Cine
    ("Joe Hisaishi - Merry Go Round of Life", "https://www.youtube.com/watch?v=BaAIGNwlqHo"),
    ("Hans Zimmer - Interstellar Main Theme Piano", "https://www.youtube.com/watch?v=4y33h81phKU"),
    ("Koji Kondo - Super Mario Bros Theme Piano", "https://www.youtube.com/watch?v=NTa6Xbzfq1U"),
    ("Joe Hisaishi - Summer One Summer's Day", "https://www.youtube.com/watch?v=JnJgOHXRBt0"),
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

print("\n=== BATCH 3 DONE ===", flush=True)
