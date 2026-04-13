import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const DOWNLOAD_URL = 'https://get.perfetto.dev/trace_processor';
const DEFAULT_CACHE_DIR = path.join(os.homedir(), '.roku-perfetto', 'bin');
const BINARY_NAME = 'trace_processor';

function getPlatform(): 'linux' | 'mac' {
  const p = os.platform();
  if (p === 'darwin') return 'mac';
  if (p === 'linux') return 'linux';
  throw new Error(
    `Unsupported platform "${p}". Perfetto trace_processor prebuilts are only available for Linux and macOS.`,
  );
}

export function defaultBinaryPath(): string {
  return path.join(DEFAULT_CACHE_DIR, BINARY_NAME);
}

export async function downloadBinary(destPath: string): Promise<void> {
  getPlatform(); // validate platform

  const destDir = path.dirname(destPath);
  await fs.mkdir(destDir, { recursive: true });

  await execFileAsync('curl', ['-L', '-o', destPath, DOWNLOAD_URL], {
    timeout: 120_000,
  });
  await fs.chmod(destPath, 0o755);
}

export async function ensureBinary(binPath?: string): Promise<string> {
  const resolved = binPath ?? defaultBinaryPath();

  if (existsSync(resolved)) {
    return resolved;
  }

  await downloadBinary(resolved);
  return resolved;
}
