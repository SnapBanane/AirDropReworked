import { useState, useEffect } from "react";
import "./App.css";
import { Command } from "@tauri-apps/plugin-shell"; // Import Tauri's Command API
import { open } from "@tauri-apps/plugin-dialog";

function App() {
    const [engineStatus, setEngineStatus] = useState("Offline");
    const [localInfo, setLocalInfo] = useState({ name: "Unknown", ip: "0.0.0.0" });

    const [peers, setPeers] = useState({});

    const fetchPeers = async () => {
        try {
            const response = await fetch("http://localhost:8000/peers");
            const data = await response.json();
            setPeers(data);
        } catch (err) {
            console.error("Failed to fetch peers:", err);
        }
    }

    const sendFile = async (peerIp) => {
        try {
            const selectedPath = await open({
                multiple: false,
                directory: false,
            });

            if (!selectedPath) return;

            const formData = new FormData();
            formData.append("target_ip", peerIp);
            formData.append("file_path", selectedPath);

            const response = await fetch("http://localhost:8000/send-to-peer", {
                method: "POST",
                body: formData,
            });

            const result = await response.json();
            alert(result.message || result.error);

        } catch (err) {
            console.error("Transfer failed", err);
        }
    };

    const checkEngine = async () => {
        try {
            const response = await fetch("http://localhost:8000/status");
            if (response.ok) {
                const data = await response.json();
                setEngineStatus("Online");
                setLocalInfo({ name: data.name, ip: data.ip });
            } else {
                setEngineStatus("Error");
            }
        } catch (error) {
            setEngineStatus("Offline (Is Python running?)");
        }
    };

    useEffect(() => {
        checkEngine();
        const interval = setInterval(fetchPeers, 5000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const startSidecar = async () => {
            try {
                // This starts 'binaries/adrw-engine'
                const sidecar = Command.sidecar("binaries/adrw-engine");
                const child = await sidecar.spawn();

                console.log("Python Sidecar started with PID:", child.pid);

                // Optional: Listen to the Python output for debugging
                sidecar.stdout.on("data", (line) => console.log(`Python: ${line}`));
                sidecar.stderr.on("data", (line) => console.error(`Python Error: ${line}`));

            } catch (err) {
                console.error("Failed to spawn sidecar:", err);
            }
        };

        startSidecar();
    }, []);

    return (
        <div className="container">
            <header>
                <h1>AirDropReworked</h1>
                <div className={`status-badge ${engineStatus === "Online" ? "online" : "offline"}`}>
                    Engine: {engineStatus}
                </div>
            </header>

            <main>
                <section className="local-device">
                    <h3>Your Device</h3>
                    <p><strong>Name:</strong> {localInfo.name}</p>
                    <p><strong>IP Address:</strong> {localInfo.ip}</p>
                    <button onClick={checkEngine}>Refresh Engine</button>
                </section>

                <hr />

                <section className="discovery">
                    <h3>Nearby Devices</h3>
                    {peers.length === 0 ? (
                        <p className="hint">Searching for other ADRW users...</p>
                    ) : (
                        <div className="peer-list">
                            {Object.entries(peers).map(([name, ip]) => (
                                <div key={name} className="peer-card">
                                    <strong>{name}</strong>
                                    <button onClick={() => sendFile(ip)}>Send File</button>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </main>
        </div>
    );
}

export default App;