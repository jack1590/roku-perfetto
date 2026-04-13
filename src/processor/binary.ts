import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const PERFETTO_VERSION = 'v54.0';
const DEFAULT_CACHE_DIR = path.join(os.homedir(), '.roku-perfetto', 'bin');
const BINARY_NAME = 'trace_processor_shell';

/**
 * Direct download URLs for the actual trace_processor_shell binary.
 * These bypass the Python wrapper script at get.perfetto.dev which requires
 * python3 in PATH — problematic in IDE-hosted MCP server processes.
 */
const BINARY_URLS: Record<string, string> = {
  'darwin-arm64': `https://commondatastorage.googleapis.com/perfetto-luci-artifacts/${PERFETTO_VERSION}/mac-arm64/${BINARY_NAME}`,
  'darwin-x64': `https://commondatastorage.googleapis.com/perfetto-luci-artifacts/${PERFETTO_VERSION}/mac-amd64/${BINARY_NAME}`,
  'linux-x64': `https://commondatastorage.googleapis.com/perfetto-luci-artifacts/${PERFETTO_VERSION}/linux-amd64/${BINARY_NAME}`,
  'linux-arm64': `https://commondatastorage.googleapis.com/perfetto-luci-artifacts/${PERFETTO_VERSION}/linux-arm64/${BINARY_NAME}`,
  'linux-arm': `https://commondatastorage.googleapis.com/perfetto-luci-artifacts/${PERFETTO_VERSION}/linux-arm/${BINARY_NAME}`,
};

function getBinaryUrl(): string {
  const key = `${os.platform()}-${os.arch()}`;
  const url = BINARY_URLS[key];
  if (!url) {
    throw new Error(
      `No trace_processor_shell binary available for ${key}. Supported: ${Object.keys(BINARY_URLS).join(', ')}`,
    );
  }
  return url;
}

export function defaultBinaryPath(): string {
  return path.join(DEFAULT_CACHE_DIR, BINARY_NAME);
}

export async function downloadBinary(destPath: string): Promise<void> {
  const url = getBinaryUrl();
  const destDir = path.dirname(destPath);
  await fs.mkdir(destDir, { recursive: true });

  const tmpPath = `${destPath}.${Date.now()}.tmp`;
  try {
    await execFileAsync('curl', ['-f', '-L', '-o', tmpPath, url], {
      timeout: 120_000,
    });
    await fs.chmod(tmpPath, 0o755);
    await fs.rename(tmpPath, destPath);
  } catch (e) {
    await fs.unlink(tmpPath).catch(() => {});
    throw e;
  }
}

export async function ensureBinary(binPath?: string): Promise<string> {
  const resolved = binPath ?? defaultBinaryPath();

  if (existsSync(resolved)) {
    const stat = await fs.stat(resolved);
    if (stat.size > 1_000_000) {
      return resolved;
    }
    // File exists but is too small (likely the old Python wrapper script).
    await fs.unlink(resolved);
  }

  await downloadBinary(resolved);
  return resolved;
}
