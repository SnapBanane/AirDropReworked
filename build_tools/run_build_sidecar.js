import { spawnSync } from 'child_process';
import os from 'os';
import path from 'path';

const isWindows = os.platform() === 'win32';
const venvPythonPath = isWindows
  ? path.join('binaries', '.venv', 'Scripts', 'python.exe')
  : path.join('binaries', '.venv', 'bin', 'python');

const result = spawnSync(venvPythonPath, ['build_tools/build_sidecar.py'], {
  stdio: 'inherit',
});

if (result.error) {
  console.error(`Error running python executable at ${venvPythonPath}:`, result.error);
  process.exit(1);
}
if (result.status !== 0) {
  process.exit(result.status);
}

