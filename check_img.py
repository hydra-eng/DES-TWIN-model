from PIL import Image
try:
    with Image.open(r"c:\Users\achuk\Downloads\simulation\frontend-v2\public\station_icon.png") as img:
        print(f"IMAGE_SIZE: {img.width}x{img.height}")
except Exception as e:
    print(e)
