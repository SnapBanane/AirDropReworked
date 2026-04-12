import {useState, useEffect, useCallback} from "react";
import {Command} from "@tauri-apps/plugin-shell";
import {open} from "@tauri-apps/plugin-dialog";
import "./App.css";

function App() {
    const [status, setStatus] = useState("Starting...");
    const [info, setInfo] = useState({name: "-", ip: "-"});
    const [peers, setPeers] = useState({});

    const sync = useCallback(async () => {
        try {
            const res = await fetch("http://localhost:8000/status");
            const data = await res.json();
            setInfo(data);
            setStatus("Online");

            const pRes = await fetch("http://localhost:8000/peers");
            setPeers(await pRes.json());
        } catch (e) {
            setStatus("Offline");
        }
    }, []);

    useEffect(() => {
        const run = async () => {
            const cmd = Command.sidecar("binaries/adrw-engine");
            cmd.stdout.on("data", (line) => {
                if (line.includes("ENGINE_READY")) sync();
            });
            await cmd.spawn();
        };
        run();
        const inv = setInterval(sync, 3000);
        return () => clearInterval(inv);
    }, [sync]);

    const send = async (ip, port) => {
        const path = await open({multiple: false});
        if (!path) return;
        const fd = new FormData();
        fd.append("target_ip", ip);
        fd.append("target_port", port);
        fd.append("file_path", path);

        const res = await fetch("http://localhost:8000/sent-to-peer", {method: "POST", body: fd});
        const out = await res.json();
        alert(out.status === "ok" ? "Sent!" : "Failed");
    };

    return (<div className="app">
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
            <h3>Nearby</h3>
            <div className="grid">
                {Object.entries(peers).map(([name, data]) => (<div key={name} className="card">
                    <span>{name}</span>
                    <button onClick={() => send(data.ip, data.port)}>Send</button>
                </div>))}
                {Object.keys(peers).length === 0 && <p className="empty">No devices found</p>}
            </div>
        </section>
    </div>);
}

export default App;