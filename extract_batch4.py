import urllib.request, json, time

API = "http://localhost:8000"

songs = [
    # Clasicos
    ("Chopin - Nocturne Op 9 No 1", "https://www.youtube.com/watch?v=ZtIW2r1EalM"),
    ("Schubert - Impromptu Op 90 No 3", "https://www.youtube.com/watch?v=KkzjOBG79HI"),
    ("Debussy - Reverie", "https://www.youtube.com/watch?v=QRjllL-MP0U"),
    ("Chopin - Fantaisie Impromptu", "https://www.youtube.com/watch?v=75x6DncZDgI"),
    ("Beethoven - Pathetique Sonata 2nd Movement", "https://www.youtube.com/watch?v=SrcOcKYQX3c"),
    # Pop / Cine
    ("Ludovico Einaudi - Nuvole Bianche", "https://www.youtube.com/watch?v=4VR-6AS0-l4"),
    ("Ludovico Einaudi - Experience", "https://www.youtube.com/watch?v=_VONMkKkdf4"),
    ("Kyle Landry - Dearly Beloved Kingdom Hearts", "https://www.youtube.com/watch?v=g25QXnhVijQ"),
    ("The Entertainer - Scott Joplin", "https://www.youtube.com/watch?v=fPmruHc4S9Q"),
    ("Gymnopedie No 1 - Erik Satie", "https://www.youtube.com/watch?v=S-Xm7s9eGxU"),
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

print("\n=== BATCH 4 DONE ===", flush=True)
