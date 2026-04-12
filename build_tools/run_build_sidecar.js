import { spawnSync } from 'child_process';
import os from 'os';
import path from 'path';
import fs from 'fs';

if (process.env.CI || process.env.GITHUB_ACTIONS) {
  console.log('Skipping engine build in CI, as it is handled by the workflow steps.');
  process.exit(0);
}

const isWindows = os.platform() === 'win32';
const venvPythonPath = isWindows
  ? path.join('binaries', '.venv', 'Scripts', 'python.exe')
  : path.join('binaries', '.venv', 'bin', 'python');

const pythonExecutable = fs.existsSync(venvPythonPath) ? venvPythonPath : 'python';

const result = spawnSync(pythonExecutable, ['build_tools/build_sidecar.py'], {
  stdio: 'inherit',
});

if (result.error) {
  console.error(`Error running python executable at ${pythonExecutable}:`, result.error);
  process.exit(1);
}
if (result.status !== 0) {
  process.exit(result.status);
}
