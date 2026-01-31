import pandas as pd
import os

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")

print("DATA_DIR:", DATA_DIR)
print("Files:", os.listdir(DATA_DIR) if os.path.exists(DATA_DIR) else "NOT FOUND")

partners_path = os.path.join(DATA_DIR, "Partners.xlsx")
if os.path.exists(partners_path):
    df = pd.read_excel(partners_path, engine='openpyxl')
    print("\n--- Partners.xlsx ---")
    print("Columns:", list(df.columns))
    print("Sample:\n", df.head(2))
else:
    print("Partners.xlsx NOT FOUND")

battery_path = os.path.join(DATA_DIR, "BatteryLogs.xlsx")
if os.path.exists(battery_path):
    df = pd.read_excel(battery_path, engine='openpyxl')
    print("\n--- BatteryLogs.xlsx ---")
    print("Columns:", list(df.columns))
    print("Sample:\n", df.head(2))
else:
    print("BatteryLogs.xlsx NOT FOUND")
