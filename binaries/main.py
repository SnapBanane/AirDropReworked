import os
import shutil
import socket
import threading
import time
import psutil
import requests

from contextlib import asynccontextmanager

from pathlib import Path

from fastapi import FastAPI, UploadFile, File, Form, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware

from zeroconf import ServiceBrowser, ServiceListener
from zeroconf.asyncio import AsyncZeroconf, AsyncServiceInfo

from config import load_device


def get_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
    except:
        ip = "127.0.0.1"
    finally:
        s.close()
    return ip


def watch_parent_process():
    try:
        parent = psutil.Process(os.getpid()).parent()
        while parent.is_running():
            time.sleep(1)
    except:
        pass
    os._exit(0)


class ADRWListener(ServiceListener):
    def __init__(self):
        self.peers = {}
        self.ignore_name = None

    def remove_service(self, zc, type_, name):
        clean_name = name.split(".")[0]
        if clean_name in self.peers: del self.peers[clean_name]

    def add_service(self, zc, type_, name):
        info = zc.get_service_info(type_, name)
        if info:
            clean_name = name.split(".")[0]
            if self.ignore_name and clean_name == self.ignore_name: return
            addresses = [socket.inet_ntoa(addr) for addr in info.addresses]
            self.peers[clean_name] = {"ip": addresses[0], "port": info.port}


adrw_listener = ADRWListener()


@asynccontextmanager
async def lifespan(app: FastAPI):
    local_ip = get_ip()
    port = getattr(app.state, "port", 8000)
    name = getattr(app.state, "device_name", "ADRW-Device")
    adrw_listener.ignore_name = name

    info = AsyncServiceInfo("_adrw._tcp.local.", f"{name}._adrw._tcp.local.",
                            addresses=[socket.inet_aton(local_ip)], port=port, properties={})
    aio_zc = AsyncZeroconf()
    browser = ServiceBrowser(aio_zc.zeroconf, "_adrw._tcp.local.", adrw_listener)
    await aio_zc.async_register_service(info)

    print("ENGINE_READY", flush=True)

    yield
    await aio_zc.async_unregister_service(info)
    await aio_zc.async_close()


pending_transfer = {"available": False, "filename": None, "sender_name": None, "sender_ip": None}

app = FastAPI(lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.get("/status")
async def status():
    return {"name": app.state.device_name, "ip": get_ip()}


@app.get("/peers")
async def get_peers():
    return adrw_listener.peers


@app.get("/check-request")
async def check_request():
    return pending_transfer


@app.post("/request-transfer")
async def request_transfer(filename: str = Form(...), sender_name: str = Form(...), sender_ip: str = Form(...)):
    global pending_transfer
    pending_transfer = {
        "available": True,
        "filename": filename,
        "sender_name": sender_name,
        "sender_ip": sender_ip,
    }
    return {"status": "waiting_for_user"}


@app.post("/respond-transfer")
async def respond_transfer(accepted: bool = Form(...)):
    global pending_transfer
    if not accepted:
        pending_transfer["available"] = False
        return {"status": "denied"}
    return {"status": "accepted"}


@app.post("/receive-final")
async def receive_final(save_path: str = Form(...), file: UploadFile = File(...)):
    global pending_transfer
    try:
        with open(save_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        pending_transfer["available"] = False
        return {"status": "ok"}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@app.post("/recieve")
async def recieve(file: UploadFile = File(...)):
    save_path = Path.home() / "Downloads" / "ADRW_Received"
    save_path.mkdir(parents=True, exist_ok=True)
    target = save_path / file.filename
    with target.open("wb") as b: shutil.copyfileobj(file.file, b)
    return {"status": "ok"}


@app.post("/sent-to-peer")
async def send(target_ip: str = Form(...), target_port: int = Form(...), file_path: str = Form(...)):
    p = Path(file_path)
    if not p.exists(): return {"status": "error", "message": "File not found"}
    try:
        with p.open("rb") as f:
            r = requests.post(f"http://{target_ip}:{target_port}/recieve", files={"file": (p.name, f)}, timeout=None)
            return r.json()
    except Exception as e:
        return {"status": "error", "message": str(e)}


if __name__ == "__main__":
    import uvicorn
    import argparse

    threading.Thread(target=watch_parent_process, daemon=True).start()

    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--name", type=str, default=None)
    args = parser.parse_args()

    config = load_device()
    app.state.device_name = args.name if args.name else config.get("device_name")
    app.state.port = args.port

    uvicorn.run(app, host="0.0.0.0", port=args.port, log_level="critical", access_log=False)
