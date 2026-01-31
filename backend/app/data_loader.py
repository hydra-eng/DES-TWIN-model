import pandas as pd
import os
from typing import Tuple, List, Dict, Any
from app.core.logging import get_logger

logger = get_logger(__name__)

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")

def load_real_network() -> Tuple[List[Dict[str, Any]], float]:
    """
    Load real operational data from Excel files.
    
    Returns:
        Tuple containing:
        - List of station dictionaries (id, name, location, total_batteries, type).
        - Average arrival time in minutes (calculated from ChargingEvents).
    """
    partners_path = os.path.join(DATA_DIR, "Partners.xlsx")
    inventory_path = os.path.join(DATA_DIR, "BatteryLogs.xlsx")
    physics_path = os.path.join(DATA_DIR, "ChargingEvents.xlsx")
    
    print(f"[DEBUG] DATA_DIR: {DATA_DIR}")
    print(f"[DEBUG] Partners exists: {os.path.exists(partners_path)}")

    if not os.path.exists(partners_path):
        logger.warning(f"Data file not found: {partners_path}. Using random fallback.")
        print(f"[ERROR] Partners.xlsx not found at {partners_path}")
        return [], 10.0

    # 1. Load Locations (Partners)
    try:
        df_partners = pd.read_excel(partners_path, engine='openpyxl')
        df_partners.columns = [c.lower().strip() for c in df_partners.columns]
        print(f"[DEBUG] Partners columns: {list(df_partners.columns)}")
        print(f"[DEBUG] Partners rows: {len(df_partners)}")
    except Exception as e:
        print(f"[ERROR] Failed to read Partners.xlsx: {e}")
        return [], 10.0
    
    # 2. Load Inventory (BatteryLogs) - Optional
    inventory_map = {}
    if os.path.exists(inventory_path):
        try:
            df_inventory = pd.read_excel(inventory_path, engine='openpyxl')
            df_inventory.columns = [c.lower().strip() for c in df_inventory.columns]
            if 'occupant' in df_inventory.columns and 'batteryid' in df_inventory.columns:
                inventory_counts = df_inventory.groupby('occupant')['batteryid'].nunique()
                inventory_map = inventory_counts.to_dict()
                print(f"[DEBUG] Loaded inventory for {len(inventory_map)} stations")
        except Exception as e:
            print(f"[WARNING] Failed to load BatteryLogs: {e}")

    # 3. Load Physics (ChargingEvents) - Optional
    avg_arrival_time_min = 15.0
    if os.path.exists(physics_path):
        try:
            df_physics = pd.read_excel(physics_path, engine='openpyxl')
            df_physics.columns = [c.lower().strip() for c in df_physics.columns]
            if 'discharging_time' in df_physics.columns:
                # Convert to numeric, coercing errors to NaN
                df_physics['discharging_time'] = pd.to_numeric(df_physics['discharging_time'], errors='coerce')
                avg_arrival_time = df_physics['discharging_time'].mean()
                if not pd.isna(avg_arrival_time):
                    avg_arrival_time_min = float(avg_arrival_time)
                    print(f"[DEBUG] Avg arrival time: {avg_arrival_time_min:.2f} mins")
        except Exception as e:
            print(f"[WARNING] Failed to load ChargingEvents: {e}")
    
    # 4. Build station list from Partners
    stations = []
    for idx, row in df_partners.iterrows():
        try:
            station_id = str(row.get('id', f'unknown_{idx}'))
            lat = row.get('latitude')
            lon = row.get('longitude')
            
            # Skip invalid coordinates
            if pd.isna(lat) or pd.isna(lon):
                continue
                
            # Get inventory or default
            total_batteries = inventory_map.get(station_id, 5)
            
            # Infer Status
            status = "ACTIVE"
            if total_batteries == 0:
                status = "INACTIVE"
            elif total_batteries < 5:
                status = "MAINTENANCE"
            
            stations.append({
                "id": station_id,
                "name": f"Station {station_id}",
                "location": {"lat": float(lat), "lon": float(lon)},
                "total_batteries": int(total_batteries),
                "charger_count": 4,
                "charge_power_kw": 60.0,
                "swap_time_seconds": 90,
                "type": "CORE",
                "status": status
            })
        except Exception as row_err:
            print(f"[WARNING] Skipping row {idx}: {row_err}")
            continue
    
    print(f"[INFO] Loaded {len(stations)} Core Stations from Excel. Avg arrival: {avg_arrival_time_min:.2f} mins")
    logger.info("data_loader_success", station_count=len(stations), avg_arrival_min=avg_arrival_time_min)
    
    return stations, avg_arrival_time_min

