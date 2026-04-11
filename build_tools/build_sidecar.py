import subprocess
import shutil
import os
import platform

APP_NAME = "adrw-engine"
TARGET_TRIPLE = "x86_64-pc-windows-msvc"
DIST_NAME = f"{APP_NAME}-{TARGET_TRIPLE}"
SOURCE_FILE = "../binaries/main.py"
OUTPUT_DIR = "../src-tauri/binaries"

def build():
    subprocess.run([
        "pyinstaller",
        "--onefile",
        "--name", DIST_NAME,
        SOURCE_FILE
    ], check=True)

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    source_path = os.path.join("dist", f"{DIST_NAME}.exe")
    dest_path = os.path.join(OUTPUT_DIR, f"{DIST_NAME}.exe")

    if os.path.exists(dest_path):
        try:
            os.remove(dest_path)
        except PermissionError:
            return

    shutil.move(source_path, dest_path)

if __name__ == "__main__":
    build()