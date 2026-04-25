import urllib.request, json, time

API = "http://localhost:8000"

songs = [
    # Clasicos mas
    ("Chopin - Ballade No 1 in G Minor", "https://www.youtube.com/watch?v=RR7eUSFEcGM"),
    ("Liszt - La Campanella", "https://www.youtube.com/watch?v=MD6xMyuZls0"),
    ("Debussy - Doctor Gradus ad Parnassum", "https://www.youtube.com/watch?v=JjB5MFq7HKc"),
    ("Chopin - Etude Op 10 No 3 Tristesse", "https://www.youtube.com/watch?v=E4Fbk52Mk1w"),
    ("Mozart - Piano Sonata No 11 1st Movement", "https://www.youtube.com/watch?v=jwn7yFOyBtg"),
    # Anime / Juegos / Cine
    ("Shigatsu wa Kimi no Uso - Again Piano", "https://www.youtube.com/watch?v=sEQf5lcnj_o"),
    ("Attack on Titan - Vogel im Kafig Piano", "https://www.youtube.com/watch?v=w3UR7nsTLlg"),
    ("Minecraft - Sweden Piano", "https://www.youtube.com/watch?v=aBkEj9FUb5g"),
    ("Studio Ghibli - Kiki's Delivery Service Piano", "https://www.youtube.com/watch?v=S2hPE78cJvM"),
    ("Undertale - Megalovania Piano", "https://www.youtube.com/watch?v=eJNr06TQGSI"),
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

print("\n=== BATCH 5 DONE ===", flush=True)
