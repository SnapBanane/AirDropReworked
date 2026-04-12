import json
import socket
import sys
from pathlib import Path

BASE_DIR = Path(sys.executable).parent if getattr(sys, 'frozen', False) else Path(__file__).parent
CONFIG_FILE = BASE_DIR / 'config.json'


def load_device():
    host_name = socket.gethostname()
    default_config = {"device_name": host_name}

    if not CONFIG_FILE.exists():
        try:
            with open(CONFIG_FILE, 'w') as f:
                json.dump(default_config, f, indent=4)
            return default_config
        except Exception as e:
            print(f"Warning: Could not write config: {e}")
            return default_config

    try:
        with open(CONFIG_FILE, 'r') as f:
            config = json.load(f)
            # Ensure the key actually exists in the file
            if "device_name" not in config:
                config["device_name"] = host_name
            return config
    except (json.JSONDecodeError, IOError):
        print("Error reading config. Falling back to system hostname.")
        return default_config


def save_device_name(new_name):
    config = {"device_name": new_name}
    with open(CONFIG_FILE, 'w') as f:
        json.dump(config, f, indent=4)
