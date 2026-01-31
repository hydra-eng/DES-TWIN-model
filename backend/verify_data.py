from app.data_loader import load_real_network
import sys
import os

# Add project root to path
sys.path.append(os.getcwd())

try:
    stations, avg_time = load_real_network()
    print(f"Stations Loaded: {len(stations)}")
    if stations:
        s = stations[0]
        print(f"First Station: {s['name']} - Lat: {s['location']['lat']}, Lon: {s['location']['lon']}")
        print(f"Type: {s.get('type')}")
    else:
        print("NO STATIONS FOUND")
except Exception as e:
    print(f"ERROR: {e}")
