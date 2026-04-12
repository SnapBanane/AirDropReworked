import {useState, useEffect, useCallback, useRef} from "react";
import {Command} from "@tauri-apps/plugin-shell";
import {open, save} from "@tauri-apps/plugin-dialog";
import {getCurrentWebview} from "@tauri-apps/api/webview";
import "./App.css";

function App() {
    const sidecarStarted = useRef(false);
    const [status, setStatus] = useState("Initializing...");
    const [info, setInfo] = useState({name: "-", ip: "-"});
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
            } else if (!tData.available && transferRequest) {
                setTransferRequest(null);
            }
        } catch (e) {
            setStatus("Engine Offline");
        }
    }, [transferRequest]);

    useEffect(() => {
        const preventDefault = (e) => e.preventDefault();
        window.addEventListener("dragover", preventDefault);
        window.addEventListener("drop", preventDefault);

        let unlisten;
        if (!sidecarStarted.current) {
            sidecarStarted.current = true;
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
                    sidecarStarted.current = false;
                }
            };
            run();
        }

        const setupEvents = async () => {
            unlisten = await getCurrentWebview().onDragDropEvent((event) => {
                if (event.payload.type === "drop") {
                    const droppedPath = event.payload.paths[0];
                    const peerList = Object.values(peers);
                    if (peerList.length > 0) {
                        send(peerList[0].ip, peerList[0].port, droppedPath);
                    }
                }
            });
        };
        setupEvents();

        return () => {
            window.removeEventListener("dragover", preventDefault);
            window.removeEventListener("drop", preventDefault);
            if (unlisten) unlisten();
        };
    }, [sync, peers]);

    const send = async (ip, port, manualPath = null) => {
        let path = manualPath || await open({multiple: false});
        if (!path) return;

        setStatus("Waiting...");
        const fd = new FormData();
        fd.append("target_ip", ip);
        fd.append("target_port", port);
        fd.append("file_path", path);

        try {
            const res = await fetch("http://localhost:8000/sent-to-peer", {
                method: "POST", body: fd,
            });
            const out = await res.json();
            setStatus("Online");
            if (out.status !== "ok") alert("Refused");
        } catch (e) {
            setStatus("Online");
        }
    };

    const handleAccept = async () => {
        const currentId = transferRequest.id;
        const savePath = await save({
            defaultPath: transferRequest.filename,
        });

        if (savePath) {
            setTransferRequest(null);
            const fd = new FormData();
            fd.append("accepted", "true");
            fd.append("save_path", savePath);
            fd.append("transfer_id", currentId);
            await fetch("http://localhost:8000/respond-transfer", {
                method: "POST", body: fd,
            });
        }
    };

    const handleDecline = async () => {
        const currentId = transferRequest.id;
        setTransferRequest(null);
        const fd = new FormData();
        fd.append("accepted", "false");
        fd.append("transfer_id", currentId);
        await fetch("http://localhost:8000/respond-transfer", {
            method: "POST", body: fd,
        });
    };

    return (<div className="app-container">
            <nav className="navbar">
                <div className="logo">ADRW</div>
                <div className={`status-dot ${status.toLowerCase().replace(" ", "-")}`}>
                    {status}
                </div>
            </nav>

            <main className="main-content">
                <header className="device-header">
                    <h1>{info.name}</h1>
                    <p>{info.ip}</p>
                </header>

                <section className="peer-section">
                    <div className="section-header">
                        <h3>Nearby Devices</h3>
                    </div>

                    <div className="peer-grid">
                        {Object.entries(peers).map(([name, data]) => (<div key={name} className="peer-card">
                                <div className="peer-icon">{name[0].toUpperCase()}</div>
                                <div className="peer-info">
                                    <strong>{name}</strong>
                                    <span>{data.ip}</span>
                                </div>
                                <button className="select-file-btn" onClick={() => send(data.ip, data.port)}>
                                    Select File
                                </button>
                            </div>))}
                        {Object.keys(peers).length === 0 && (
                            <div className="empty-state">Searching for devices...</div>)}
                    </div>
                </section>
            </main>

            {transferRequest && (<div className="modal-overlay">
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
                </div>)}
        </div>);
}

export default App;