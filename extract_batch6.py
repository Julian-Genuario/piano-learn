import urllib.request, json, time

API = "http://localhost:8000"

songs = [
    # Clasicos populares para piano
    ("Chopin - Polonaise Op 53 Heroic", "https://www.youtube.com/watch?v=8QT7ITv9Ecs"),
    ("Scarlatti - Sonata in D Minor K141", "https://www.youtube.com/watch?v=Gy5U2X72vEg"),
    ("Grieg - In the Hall of the Mountain King Piano", "https://www.youtube.com/watch?v=dRpzxKsSEZg"),
    ("Tchaikovsky - Dance of the Sugar Plum Fairy Piano", "https://www.youtube.com/watch?v=OweZ1rynMHg"),
    ("Debussy - Golliwogs Cakewalk", "https://www.youtube.com/watch?v=XMrdhvyQ9vE"),
    # Pop / Modern
    ("Adele - Someone Like You Piano", "https://www.youtube.com/watch?v=20LqRMHMtzw"),
    ("Coldplay - The Scientist Piano", "https://www.youtube.com/watch?v=HsHD7TJEVmE"),
    ("Elton John - Your Song Piano", "https://www.youtube.com/watch?v=HSnMvJuPJHI"),
    ("Queen - Bohemian Rhapsody Piano", "https://www.youtube.com/watch?v=fJ9rUzIMcZQ"),
    ("Billy Joel - Piano Man", "https://www.youtube.com/watch?v=gxEPV4kolz0"),
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

print("\n=== BATCH 6 DONE ===", flush=True)
