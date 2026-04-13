export function fmtDuration(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(0)}µs`;
  if (ms < 1000) return `${ms.toFixed(1)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export function fmtPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function fmtNum(value: number): string {
  return value.toLocaleString('en-US');
}

export function pad(str: string, width: number): string {
  return str.padStart(width);
}

export function padEnd(str: string, width: number): string {
  return str.padEnd(width);
}
