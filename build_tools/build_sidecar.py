import os
import platform as _platform
import shutil
import subprocess
import sys
import time

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
APP_NAME = "adrw-engine"

platform = sys.platform
if platform == "win32":
    target = "x86_64-pc-windows-msvc"
    extension = ".exe"
elif platform == "darwin":
    override = os.environ.get("ADRW_TARGET_OVERRIDE")
    if override:
        target = override
    else:
        target = "aarch64-apple-darwin" if _platform.machine() == "arm64" else "x86_64-apple-darwin"
    extension = ""
else:
    target = "x86_64-unknown-linux-gnu"
    extension = ""

DIST_NAME = f"{APP_NAME}-{target}"
SOURCE_FILE = os.path.join(ROOT_DIR, "binaries", "main.py")
VENV_PYTHON = os.path.join(ROOT_DIR, "binaries", ".venv", "Scripts",
                           "python.exe") if platform == "win32" else os.path.join(ROOT_DIR, "binaries", ".venv", "bin",
                                                                                  "python")
OUTPUT_DIR = os.path.join(ROOT_DIR, "src-tauri", "binaries")


def build():
    if os.path.exists(VENV_PYTHON):
        python = VENV_PYTHON
    else:
        python = sys.executable
        print(f"Venv not found, falling back to: {python}")

    if platform == "win32":
        subprocess.run(["taskkill", "/F", "/IM", f"{DIST_NAME}.exe", "/T"], stderr=subprocess.DEVNULL,
                       stdout=subprocess.DEVNULL)

    time.sleep(0.5)

    try:
        subprocess.run([
            python, "-m", "PyInstaller",
            "--onefile", "--noconsole", "--clean",
            "--name", DIST_NAME,
            SOURCE_FILE
        ], check=True, cwd=ROOT_DIR)

        source_exe = os.path.join(ROOT_DIR, "dist", f"{DIST_NAME}{extension}")
        dest_exe = os.path.join(OUTPUT_DIR, f"{DIST_NAME}{extension}")

        os.makedirs(OUTPUT_DIR, exist_ok=True)
        if os.path.exists(dest_exe):
            os.remove(dest_exe)
        shutil.move(source_exe, dest_exe)
        print(f"Build complete: {dest_exe}")

    except Exception as e:
        print(f"Build failed: {e}")


if __name__ == "__main__":
    build()
