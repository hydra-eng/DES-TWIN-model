import json

import requests

try:
    r = requests.get("http://127.0.0.1:8000/api/v1/stations", timeout=30)
    print(f"Status: {r.status_code}")
    if r.ok:
        stations = r.json()
        print(f"Count: {len(stations)}")
        if stations:
            print(f"First: {json.dumps(stations[0], indent=2)}")
    else:
        print(f"Error: {r.text[:500]}")
except Exception as e:
    print(f"Request failed: {e}")
