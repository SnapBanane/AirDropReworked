import json
import os

CONFIG_FILE = 'config.json'


def load_device():
    default_config = {"device_name": "ADRW Device"}

    if not os.path.exists(CONFIG_FILE):
        with open(CONFIG_FILE, 'w') as f:
            json.dump(default_config, f)
        return default_config

    with open(CONFIG_FILE, 'r') as f:
        try:
            config = json.load(f)
            return config
        except json.JSONDecodeError:
            print("Error decoding config file. Using default configuration.")
            return default_config
