import socket
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from zeroconf.asyncio import AsyncZeroconf, AsyncServiceInfo
from zeroconf import ServiceBrowser, ServiceListener, Zeroconf

from config import load_device


def get_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
    except Exception:
        ip = "127.0.0.1"
    finally:
        s.close()
    return ip


class ADRWListener(ServiceListener):
    def __init__(self):
        self.peers = {}

    def update_service(self, zc, type_, name):
        pass  # unneded rn

    def remove_service(self, zc, type_, name):
        if name in self.peers:
            del self.peers[name]
            print(f"Peer removed: {name}")

    def add_service(self, zc, type_, name):
        info = zc.get_service_info(type_, name)
        if info:
            addresses = [socket.inet_ntoa(addr) for addr in info.addresses]

            clean_name = name.split(".")[0]
            self.peers[clean_name] = addresses[0] if addresses else "unknown"
            print(f"Device found: {clean_name} at {self.peers[clean_name]}")


adrw_listener = ADRWListener()


@asynccontextmanager
async def lifespan(app: FastAPI):
    local_ip = get_ip()
    port = getattr(app.state, "port", 8000)

    name = getattr(app.state, "device_name", "ADRW-Device")
    service_name = f"{name}._adrw._tcp.local."

    desc = {'path': '/'}
    info = AsyncServiceInfo(
        "_adrw._tcp.local.",
        service_name,
        addresses=[socket.inet_aton(local_ip)],
        port=port,
        properties=desc,
    )

    aio_zc = AsyncZeroconf()

    browser = ServiceBrowser(aio_zc.zeroconf, "_adrw._tcp.local.", adrw_listener)

    await aio_zc.async_register_service(info)
    app.state.local_ip = local_ip

    yield

    # shutdown
    browser.cancel()
    await aio_zc.async_unregister_service(info)
    await aio_zc.async_close()


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)


@app.get("/status")
async def read_root():
    return {
        "status": "ok",
        "name": getattr(app.state, "device_name", "unknown"),
        "ip": getattr(app.state, "local_ip", "unknown")
    }


@app.get("/peers")
async def get_peers():
    return adrw_listener.peers


if __name__ == "__main__":
    import uvicorn
    import argparse

    parser = argparse.ArgumentParser()

    parser.add_argument("--port", type=int, default=8000, help="Port to run the server on (default: 8000)")
    parser.add_argument("--host", type=str, default="0.0.0.0")
    parser.add_argument("--name", type=str, default="ADRW Device", help="Device name to advertise (default: ADRW Device)")

    args = parser.parse_args()

    if args.name:
        print("loading name from args...")
        chosen_name = args.name
    else:
        print("loading name from config...")
        current_config = load_device()
        chosen_name = current_config["device_name", "ADRW-Device"]

    app.state.device_name = chosen_name
    app.state.port = args.port

    uvicorn.run(app, host=args.host, port=args.port)
