# AirDropReworked

A cross-platform local file transfer app — basically AirDrop, but for Windows, macOS, and Android. No accounts, no cloud, no nonsense. Devices on the same network discover each other automatically and files go directly peer-to-peer.

Built with [Tauri 2](https://tauri.app/) + React on the frontend and a Python/FastAPI sidecar handling discovery and transfer on the backend.

---

## How it works

When you launch the app, a Python sidecar (`adrw-engine`) starts in the background. It registers your device on the local network using mDNS (Zeroconf) under the `_adrw._tcp.local.` service type, and simultaneously scans for other devices doing the same.

When you send a file, the sender pings the receiver with a handshake request. The receiver gets a prompt — accept or deny. If accepted, the file streams directly over HTTP to the path the receiver chose. No relay server, no intermediary.

```
Sender                          Receiver
  |                                 |
  |-- POST /request-transfer ------>|   (filename + sender info)
  |<-- { status: "accepted", ... } -|   (receiver picks save path)
  |-- POST /receive-final --------->|   (actual file upload)
  |<-- { status: "ok" } -----------|
```

---

## Stack

| Layer | Tech |
|---|---|
| UI | Tauri 2, React 19, Vite |
| Backend sidecar | Python, FastAPI, Uvicorn |
| Discovery | Zeroconf / mDNS |
| Build | PyInstaller, GitHub Actions |

---

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [Rust](https://rustup.rs/) (stable)
- Python 3.10+ with a virtualenv set up under `binaries/.venv`

### Install dependencies

```bash
npm install
```

Set up the Python venv and install the sidecar dependencies:

```bash
# Tested with python 3.13 and 3.14
cd binaries
python -m venv .venv
 # Windows
.venv/Scripts/pip install fastapi uvicorn requests psutil zeroconf pyinstaller httpx python-multipart
# macOS/Linux
.venv/bin/pip install fastapi uvicorn requests psutil zeroconf pyinstaller httpx python-multipart
```

### Run in development

```bash
npm run dev:all
```

This builds the engine binary first (`build:engine`), then launches the Tauri dev environment.

### Build for release

```bash
npm run tauri build
```

The Python sidecar gets compiled to a standalone binary via PyInstaller and bundled into the Tauri app automatically. The output binary ends up at `src-tauri/binaries/adrw-engine-{target}`.

---

## CI / Releases

GitHub Actions builds for Windows, macOS (universal), and Ubuntu on every push to `main`. Releases are created as drafts — check the [Releases](../../releases) tab.

The workflow installs Python dependencies directly (no venv in CI) and runs `npm run build:engine` before the Tauri build step.

---

## Project structure

```
├── binaries/
│   ├── main.py          # FastAPI sidecar — discovery, transfer logic
│   ├── config.py        # Device name persistence
│   └── config.json      # Generated config (device_name)
├── build_tools/
│   └── build_sidecar.py # PyInstaller wrapper
├── src-tauri/
│   ├── tauri.conf.json
│   ├── capabilities/
│   │   └── default.json # Shell/sidecar permissions
│   └── Cargo.toml
└── src/                 # React frontend (Vite)
```

---

## Configuration

On first launch, `config.json` is created next to the binary using your system hostname as the default device name. You can rename your device from within the app — it updates `config.json` and re-registers on the network.

---

## Supported platforms

| Platform | Status     |
|---|------------|
| Windows | Yes        |
| macOS | Yes        |
| Android | Planned    |
| Linux | Not Tested |

---

## License

MIT — see [LICENSE](LICENSE).