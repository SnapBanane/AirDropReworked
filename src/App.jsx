import { useState, useEffect, useCallback } from "react";
import { Command } from "@tauri-apps/plugin-shell";
import { open } from "@tauri-apps/plugin-dialog";
import "./App.css";

function App() {
    const [status, setStatus] = useState("Connecting...");
    const [info, setInfo] = useState({ name: "-", ip: "-" });
    const [peers, setPeers] = useState({});

    // Memoized sync function for stability
    const sync = useCallback(async () => {
        try {
            const res = await fetch("http://localhost:8000/status");
            if (res.ok) {
                const data = await res.json();
                setInfo(data);
                setStatus("Online");

                const pRes = await fetch("http://localhost:8000/peers");
                setPeers(await pRes.json());
            }
        } catch (e) {
            // Don't flip to offline immediately to prevent flickering during boot
        }
    }, []);

    useEffect(() => {
        let interval;
        const startApp = async () => {
            try {
                const cmd = Command.sidecar("binaries/adrw-engine");

                // Listen for the specific "READY" signal from Python
                cmd.stdout.on("data", (line) => {
                    if (line.includes("ENGINE_READY")) {
                        sync();
                        // Start polling peers only after engine is confirmed ready
                        interval = setInterval(sync, 3000);
                    }
                });

                await cmd.spawn();
            } catch (err) {
                console.error("Sidecar failed:", err);
                setStatus("Offline");
            }
        };

        startApp();
        return () => { if (interval) clearInterval(interval); };
    }, [sync]);

    const send = async (ip, port) => {
        const path = await open({ multiple: false });
        if (!path) return;

        const fd = new FormData();
        fd.append("target_ip", ip);
        fd.append("target_port", port);
        fd.append("file_path", path);

        try {
            const res = await fetch("http://localhost:8000/sent-to-peer", { method: "POST", body: fd });
            const out = await res.json();
            if (out.status === "ok") alert("Success!");
            else alert("Error: " + out.message);
        } catch (e) {
            alert("Transfer failed: Connection lost");
        }
    };

    return (
        <div className="app">
            <nav>
                <h2>ADRW</h2>
                <span className={`tag ${status.toLowerCase()}`}>{status}</span>
            </nav>

            <div className="hero">
                <div className="device-info">
                    <h1>{info.name}</h1>
                    <code>{info.ip}</code>
                </div>
            </div>

            <section className="peers">
                <h3>Nearby Devices</h3>
                <div className="grid">
                    {Object.entries(peers).map(([name, data]) => (
                        <div key={name} className="card">
                            <span>{name}</span>
                            <button onClick={() => send(data.ip, data.port)}>Send File</button>
                        </div>
                    ))}
                    {Object.keys(peers).length === 0 && (
                        <p className="empty">Looking for peers...</p>
                    )}
                </div>
            </section>
        </div>
    );
}

export default App;