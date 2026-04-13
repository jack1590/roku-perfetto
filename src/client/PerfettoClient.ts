import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';
import WebSocket from 'ws';
import fs from 'fs';
import type { EnableResult, RecordingSession, RecordingResult } from '../types.js';

const xmlParser = new XMLParser({ ignoreAttributes: false });

export class PerfettoClient {
  private ws: WebSocket | null = null;
  private session: RecordingSession | null = null;
  private writeStream: fs.WriteStream | null = null;

  constructor(private host: string) {}

  async enable(channelId = 'dev'): Promise<EnableResult> {
    const url = `http://${this.host}:8060/perfetto/enable/${channelId}`;
    const resp = await axios.post(url);
    const parsed = xmlParser.parse(resp.data);
    const root = parsed['perfetto-enable'] ?? parsed;

    const channels = root['enabled-channels']?.channel;
    const enabledChannels: string[] = Array.isArray(channels)
      ? channels
      : channels != null
        ? [String(channels)]
        : [];

    return {
      enabledChannels,
      timestamp: Number(root.timestamp ?? 0),
      timestampEnd: Number(root['timestamp-end'] ?? 0),
      status: String(root.status ?? 'unknown'),
    };
  }

  async startRecording(filePath: string, channelId = 'dev'): Promise<RecordingSession> {
    if (this.session?.recording) {
      throw new Error(
        `Already recording on ${this.session.host}. Stop the current session first.`,
      );
    }

    return new Promise<RecordingSession>((resolve, reject) => {
      const wsUrl = `ws://${this.host}:8060/perfetto-session`;
      const ws = new WebSocket(wsUrl);
      ws.binaryType = 'nodebuffer';

      const writeStream = fs.createWriteStream(filePath);
      let bytesWritten = 0;
      const startedAt = Date.now();

      const timeout = setTimeout(() => {
        ws.terminate();
        writeStream.destroy();
        reject(new Error(`WebSocket connection to ${wsUrl} timed out`));
      }, 15_000);

      ws.on('open', () => {
        clearTimeout(timeout);
        this.ws = ws;
        this.writeStream = writeStream;
        this.session = {
          host: this.host,
          channelId,
          filePath,
          bytesWritten: 0,
          startedAt,
          recording: true,
        };
        resolve(this.session);
      });

      ws.on('message', (data: Buffer) => {
        writeStream.write(data);
        bytesWritten += data.length;
        if (this.session) {
          this.session.bytesWritten = bytesWritten;
        }
      });

      ws.on('close', () => {
        writeStream.end();
        if (this.session) {
          this.session.recording = false;
        }
      });

      ws.on('error', (err) => {
        clearTimeout(timeout);
        writeStream.destroy();
        if (this.session) {
          this.session.recording = false;
        }
        if (!this.session) {
          reject(err);
        }
      });
    });
  }

  async stopRecording(): Promise<RecordingResult> {
    if (!this.session?.recording || !this.ws) {
      throw new Error('No active Perfetto recording session');
    }

    const { filePath, bytesWritten, startedAt } = this.session;

    this.ws.close();
    await new Promise<void>((resolve) => {
      if (this.writeStream) {
        this.writeStream.on('finish', resolve);
        this.writeStream.end();
      } else {
        resolve();
      }
    });

    const durationMs = Date.now() - startedAt;
    this.ws = null;
    this.writeStream = null;
    this.session = null;

    return { filePath, bytesWritten, durationMs };
  }

  isRecording(): boolean {
    return this.session?.recording === true;
  }

  getSession(): RecordingSession | null {
    return this.session ? { ...this.session } : null;
  }
}
