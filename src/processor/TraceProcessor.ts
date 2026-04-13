import { execFile } from 'child_process';
import { promisify } from 'util';
import { ensureBinary } from './binary.js';
import type { QueryResult, QueryRow, StatusResult } from '../types.js';

const execFileAsync = promisify(execFile);
const QUERY_TIMEOUT_MS = 60_000;

export interface TraceProcessorOptions {
  binPath?: string;
  port?: number;
}

export class TraceProcessor {
  private _closed = false;
  private binPath: string;
  private tracePath: string;

  private constructor(binPath: string, tracePath: string) {
    this.binPath = binPath;
    this.tracePath = tracePath;
  }

  static async open(
    tracePath: string,
    opts?: TraceProcessorOptions,
  ): Promise<TraceProcessor> {
    const binPath = await ensureBinary(opts?.binPath);
    const tp = new TraceProcessor(binPath, tracePath);

    const testResult = await tp.query('SELECT 1 as ok');
    if (testResult.rowCount === 0) {
      throw new Error(`trace_processor failed to load trace: ${tracePath}`);
    }

    return tp;
  }

  async query(sql: string): Promise<QueryResult> {
    this.assertOpen();

    const { stdout } = await execFileAsync(
      this.binPath,
      [this.tracePath, '-Q', sql],
      { timeout: QUERY_TIMEOUT_MS, maxBuffer: 50 * 1024 * 1024 },
    );

    return this.parseCsvOutput(stdout);
  }

  async status(): Promise<StatusResult> {
    return {
      loaded: true,
      apiVersion: 0,
      tracePath: this.tracePath,
    };
  }

  async close(): Promise<void> {
    this._closed = true;
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
   * Parse the CSV output from `trace_processor -Q`.
   * Format: first line is quoted column headers, subsequent lines are quoted values.
   * Example:
   *   "ts","dur","name"
   *   31898422880059,1841848999,"ExecBrightScript"
   */
  private parseCsvOutput(raw: string): QueryResult {
    const lines = raw.split('\n').filter((line) => {
      if (!line.trim()) return false;
      if (line.startsWith('Loading trace:')) return false;
      if (line.startsWith('[')) return false;
      if (line.startsWith('Trace health')) return false;
      if (line.startsWith('  ')) return false;
      if (line.startsWith('column ')) return false;
      return true;
    });

    if (lines.length === 0) {
      return { columns: [], rows: [], rowCount: 0 };
    }

    const columns = this.parseCsvLine(lines[0]).map((c) => c.replace(/^"|"$/g, ''));

    const rows: QueryRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCsvLine(lines[i]);
      if (values.length !== columns.length) continue;

      const row: QueryRow = {};
      for (let c = 0; c < columns.length; c++) {
        row[columns[c]] = this.parseValue(values[c]);
      }
      rows.push(row);
    }

    return { columns, rows, rowCount: rows.length };
  }

  private parseCsvLine(line: string): string[] {
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (i + 1 < line.length && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          current += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        fields.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
    fields.push(current);
    return fields;
  }

  private parseValue(raw: string): string | number | null {
    if (raw === '' || raw === 'NULL') return null;

    const num = Number(raw);
    if (!isNaN(num) && raw !== '') return num;

    return raw;
  }
}
