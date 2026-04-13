import { spawn, type ChildProcess } from 'child_process';
import axios from 'axios';
import { ensureBinary } from './binary.js';
import type { QueryResult, QueryRow, StatusResult } from '../types.js';

const DEFAULT_PORT = 9001;
const STARTUP_TIMEOUT_MS = 30_000;
const POLL_INTERVAL_MS = 300;

export interface TraceProcessorOptions {
  binPath?: string;
  port?: number;
}

export class TraceProcessor {
  private process: ChildProcess | null = null;
  private port: number;
  private _closed = false;

  private constructor(port: number) {
    this.port = port;
  }

  private get baseUrl(): string {
    return `http://127.0.0.1:${this.port}`;
  }

  static async open(
    tracePath: string,
    opts?: TraceProcessorOptions,
  ): Promise<TraceProcessor> {
    const binPath = await ensureBinary(opts?.binPath);
    const port = opts?.port ?? DEFAULT_PORT;
    const tp = new TraceProcessor(port);

    tp.process = spawn(binPath, [tracePath, '--httpd', '--http-port', String(port)], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    tp.process.on('exit', () => {
      tp._closed = true;
    });

    await tp.waitForReady();
    return tp;
  }

  private async waitForReady(): Promise<void> {
    const deadline = Date.now() + STARTUP_TIMEOUT_MS;
    while (Date.now() < deadline) {
      try {
        await axios.get(`${this.baseUrl}/status`, { timeout: 2000 });
        return;
      } catch {
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      }
    }
    this.close();
    throw new Error(
      `trace_processor did not become ready within ${STARTUP_TIMEOUT_MS / 1000}s`,
    );
  }

  async query(sql: string): Promise<QueryResult> {
    this.assertOpen();

    const resp = await axios.post(
      `${this.baseUrl}/query`,
      sql,
      {
        headers: { 'Content-Type': 'application/x-protobuf' },
        responseType: 'text',
        transformResponse: [(data: string) => data],
      },
    );

    return this.parseQueryResponse(resp.data);
  }

  async status(): Promise<StatusResult> {
    this.assertOpen();
    const resp = await axios.get(`${this.baseUrl}/status`, { timeout: 5000 });
    const data = typeof resp.data === 'string' ? JSON.parse(resp.data) : resp.data;
    return {
      loaded: Boolean(data.loaded_trace_name || data.has_trace),
      apiVersion: data.api_version ?? 0,
      tracePath: data.loaded_trace_name,
    };
  }

  async close(): Promise<void> {
    if (this.process && !this._closed) {
      this.process.kill('SIGTERM');
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          this.process?.kill('SIGKILL');
          resolve();
        }, 5000);
        this.process!.on('exit', () => {
          clearTimeout(timeout);
          resolve();
        });
      });
    }
    this._closed = true;
    this.process = null;
  }

  get closed(): boolean {
    return this._closed;
  }

  private assertOpen(): void {
    if (this._closed) {
      throw new Error('TraceProcessor is closed');
    }
  }

  /**
   * Parse the text/JSON response from trace_processor /query endpoint.
   *
   * The httpd mode returns a JSON array of column values per row when
   * queried via the HTTP interface with text content type.
   */
  private parseQueryResponse(raw: string): QueryResult {
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      return { columns: [], rows: [], rowCount: 0 };
    }

    if (Array.isArray(data)) {
      return this.parseArrayResponse(data);
    }

    if (typeof data === 'object' && data !== null) {
      return this.parseObjectResponse(data as Record<string, unknown>);
    }

    return { columns: [], rows: [], rowCount: 0 };
  }

  private parseArrayResponse(data: unknown[]): QueryResult {
    if (data.length === 0) {
      return { columns: [], rows: [], rowCount: 0 };
    }

    if (typeof data[0] === 'object' && data[0] !== null && !Array.isArray(data[0])) {
      const columns = Object.keys(data[0] as Record<string, unknown>);
      const rows: QueryRow[] = data as QueryRow[];
      return { columns, rows, rowCount: rows.length };
    }

    return { columns: [], rows: [], rowCount: 0 };
  }

  private parseObjectResponse(data: Record<string, unknown>): QueryResult {
    // trace_processor returns { column_names: [...], batch: [{ cells: [...] }] }
    // or { columns: [...], ... } depending on version/mode
    const columnNames = (data.column_names ?? data.columns) as string[] | undefined;
    if (!columnNames) {
      return { columns: [], rows: [], rowCount: 0 };
    }

    const numColumns = columnNames.length;
    const rows: QueryRow[] = [];

    // Handle columnar format: { column_names, num_records, columns: [{long_values, ...}] }
    const colData = data.batch as unknown[] | undefined;
    if (Array.isArray(colData)) {
      for (const batch of colData) {
        const b = batch as Record<string, unknown>;
        const cellData = b.cells ?? b.string_cells ?? b.long_values;
        if (Array.isArray(cellData)) {
          for (let i = 0; i < cellData.length; i += numColumns) {
            const row: QueryRow = {};
            for (let c = 0; c < numColumns; c++) {
              row[columnNames[c]] = cellData[i + c] as string | number | null;
            }
            rows.push(row);
          }
        }
      }
    }

    // Handle row-oriented: { result: [...] }
    const result = data.result as unknown[] | undefined;
    if (Array.isArray(result) && rows.length === 0) {
      for (const item of result) {
        if (typeof item === 'object' && item !== null) {
          rows.push(item as QueryRow);
        }
      }
    }

    return { columns: columnNames, rows, rowCount: rows.length };
  }
}
