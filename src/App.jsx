import { useState, useEffect, useCallback } from "react";
import { Command } from "@tauri-apps/plugin-shell";
import { open, save } from "@tauri-apps/plugin-dialog";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import "./App.css";

function App() {
    const [status, setStatus] = useState("Initializing...");
    const [info, setInfo] = useState({ name: "-", ip: "-" });
    const [peers, setPeers] = useState({});
    const [transferRequest, setTransferRequest] = useState(null);

    const sync = useCallback(async () => {
        try {
            const res = await fetch("http://localhost:8000/status");
            if (res.ok) {
                const data = await res.json();
                setInfo(data);
                setStatus("Online");
            }

            const pRes = await fetch("http://localhost:8000/peers");
            if (pRes.ok) setPeers(await pRes.json());

            const tRes = await fetch("http://localhost:8000/check-request");
            const tData = await tRes.json();
            if (tData.available && !transferRequest) {
                setTransferRequest(tData);
            }
        } catch (e) {
            setStatus("Engine Offline");
        }
    }, [transferRequest]);

    useEffect(() => {
        let interval;
        const run = async () => {
            try {
                const cmd = Command.sidecar("binaries/adrw-engine");
                cmd.stdout.on("data", (line) => {
                    if (line.includes("ENGINE_READY")) {
                        sync();
                        interval = setInterval(sync, 2000);
                    }
                });
                await cmd.spawn();
            } catch (e) {
                console.error("Failed to spawn engine", e);
            }
        };

        run();

        const unlisten = getCurrentWebview().onDragDropEvent((event) => {
            if (event.payload.type === "drop") {
                const droppedPath = event.payload.paths[0];
                const firstPeer = Object.values(peers)[0];
                if (firstPeer) {
                    send(firstPeer.ip, firstPeer.port, droppedPath);
                } else {
                    alert("No peers found to drop file to.");
                }
            }
        });

        return () => {
            if (interval) clearInterval(interval);
            unlisten.then((f) => f());
        };
    }, [sync, peers]);

    const send = async (ip, port, manualPath = null) => {
        let path = manualPath || await open({ multiple: false });
        if (!path) return;

        const fd = new FormData();
        fd.append("target_ip", ip);
        fd.append("target_port", port);
        fd.append("file_path", path);

        try {
            setStatus("Sending...");
            const res = await fetch("http://localhost:8000/sent-to-peer", {
                method: "POST", body: fd,
            });
            const out = await res.json();
            setStatus("Online");
            alert(out.status === "ok" ? "File Sent Successfully!" : "Refused/Error");
        } catch (e) {
            alert("Transfer failed");
            setStatus("Online");
        }
    };

    const handleAccept = async () => {
        // Opens the Native File Explorer to choose save location
        const savePath = await save({
            defaultPath: transferRequest.filename,
        });

        if (savePath) {
            const fd = new FormData();
            fd.append("accepted", "true");
            // Pass the path chosen by the user in the explorer back to the backend
            fd.append("save_path", savePath);

            await fetch("http://localhost:8000/respond-transfer", {
                method: "POST", body: fd,
            });
            setTransferRequest(null);
        }
    };

    const handleDecline = async () => {
        const fd = new FormData();
        fd.append("accepted", "false");
        await fetch("http://localhost:8000/respond-transfer", {
            method: "POST", body: fd,
        });
        setTransferRequest(null);
    };

    return (
        <div className="app-container">
            <nav className="navbar">
                <div className="logo">ADRW</div>
                <div className={`status-dot ${status.toLowerCase()}`}>
                    {status}
                </div>
            </nav>

            <div className="main-content">
                <header className="device-header">
                    <h1>{info.name}</h1>
                    <p>{info.ip}</p>
                </header>

                <section className="peer-section">
                    <div className="section-header">
                        <h3>Nearby Devices</h3>
                        <p className="hint">Drag a file or use the button below</p>
                    </div>

                    <div className="peer-grid">
                        {Object.entries(peers).map(([name, data]) => (
                            <div key={name} className="peer-card">
                                <div className="peer-icon">{name[0].toUpperCase()}</div>
                                <div className="peer-info">
                                    <strong>{name}</strong>
                                    <span>{data.ip}</span>
                                </div>
                                {/* BUTTON ADDED BACK HERE */}
                                <button className="select-file-btn" onClick={() => send(data.ip, data.port)}>
                                    Select File
                                </button>
                            </div>
                        ))}
                        {Object.keys(peers).length === 0 && (
                            <div className="empty-state">Searching for devices...</div>
                        )}
                    </div>
                </section>
            </div>

            {transferRequest && (
                <div className="modal-overlay">
                    <div className="modal-card">
                        <div className="modal-icon">📁</div>
                        <h2>Incoming File</h2>
                        <p>
                            <strong>{transferRequest.sender_name}</strong> wants to send:
                            <br/>
                            <span className="file-name-highlight">{transferRequest.filename}</span>
                        </p>
                        <div className="modal-actions">
                            <button className="btn-accept" onClick={handleAccept}>
                                Accept & Choose Location
                            </button>
                            <button className="btn-decline" onClick={handleDecline}>
                                Decline
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default App;