import { createHash, randomUUID } from 'crypto';
import { basename } from 'path';

import {
  type CodeExecutionResult,
  type CodeInterpreterDriver,
  type ExecutionContext,
  type InputFile,
  type OutputFile,
  type StreamCallbacks,
} from 'src/engine/core-modules/code-interpreter/drivers/interfaces/code-interpreter-driver.interface';

type PermaventInternalDriverOptions = {
  runnerUrl: string;
  authToken: string;
  executionTimeoutMs: number;
  requestTimeoutMs: number;
};

type RunnerOutputFile = {
  filename: string;
  contentBase64: string;
  mimeType: string;
};

type RunnerExecutionResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
  files: RunnerOutputFile[];
  error?: string;
};

const isRunnerOutputFile = (value: unknown): value is RunnerOutputFile => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const file = value as Partial<RunnerOutputFile>;

  return (
    typeof file.filename === 'string' &&
    typeof file.contentBase64 === 'string' &&
    typeof file.mimeType === 'string'
  );
};

const isRunnerExecutionResult = (
  value: unknown,
): value is RunnerExecutionResult => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const result = value as Partial<RunnerExecutionResult>;

  return (
    typeof result.stdout === 'string' &&
    typeof result.stderr === 'string' &&
    typeof result.exitCode === 'number' &&
    Array.isArray(result.files) &&
    result.files.every(isRunnerOutputFile) &&
    (result.error === undefined || typeof result.error === 'string')
  );
};

export class PermaventInternalDriver implements CodeInterpreterDriver {
  private readonly baseUrl: string;

  constructor(private readonly options: PermaventInternalDriverOptions) {
    this.baseUrl = options.runnerUrl.replace(/\/+$/, '');
  }

  async execute(
    code: string,
    files?: InputFile[],
    context?: ExecutionContext,
    callbacks?: StreamCallbacks,
  ): Promise<CodeExecutionResult> {
    const sessionId = this.toOpaqueSessionId(
      context?.sessionId ?? `ephemeral:${randomUUID()}`,
    );
    const isEphemeral = context?.sessionId === undefined;

    try {
      const response = await this.request(`/v1/sessions/${sessionId}/execute`, {
        method: 'POST',
        body: JSON.stringify({
          code,
          files: (files ?? []).map((file) => ({
            filename: basename(file.filename),
            contentBase64: file.content.toString('base64'),
            mimeType: file.mimeType,
          })),
          env: context?.env ?? {},
          timeoutMs: this.options.executionTimeoutMs,
        }),
      });
      const payload: unknown = await response.json();

      if (!isRunnerExecutionResult(payload)) {
        throw new Error(
          'Internal code interpreter runner returned an invalid response',
        );
      }

      const outputFiles: OutputFile[] = payload.files.map((file) => ({
        filename: basename(file.filename),
        content: Buffer.from(file.contentBase64, 'base64'),
        mimeType: file.mimeType,
      }));

      this.replayStream(payload.stdout, callbacks?.onStdout);
      this.replayStream(payload.stderr, callbacks?.onStderr);

      for (const outputFile of outputFiles) {
        await callbacks?.onResult?.(outputFile);
      }

      return {
        stdout: payload.stdout,
        stderr: payload.stderr,
        exitCode: payload.exitCode,
        files: outputFiles,
        error: payload.error,
      };
    } finally {
      if (isEphemeral) {
        await this.releaseOpaqueSession(sessionId).catch(() => undefined);
      }
    }
  }

  async releaseSession(sessionId: string): Promise<void> {
    await this.releaseOpaqueSession(this.toOpaqueSessionId(sessionId));
  }

  async sweepExpiredSessions(): Promise<number> {
    return 0;
  }

  private async releaseOpaqueSession(sessionId: string): Promise<void> {
    await this.request(`/v1/sessions/${sessionId}`, { method: 'DELETE' });
  }

  private async request(
    path: string,
    init: Pick<RequestInit, 'method' | 'body'>,
  ): Promise<Response> {
    const abortController = new AbortController();
    const timeout = setTimeout(
      () => abortController.abort(),
      this.options.requestTimeoutMs,
    );

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${this.options.authToken}`,
          'Content-Type': 'application/json',
        },
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error(
          `Internal code interpreter runner returned HTTP ${response.status}`,
        );
      }

      return response;
    } catch {
      throw new Error('Internal code interpreter runner request failed');
    } finally {
      clearTimeout(timeout);
    }
  }

  private replayStream(
    stream: string,
    callback: ((line: string) => void) | undefined,
  ): void {
    if (!callback) {
      return;
    }

    for (const line of stream.split('\n')) {
      if (line.length > 0) {
        callback(line);
      }
    }
  }

  private toOpaqueSessionId(sessionId: string): string {
    return createHash('sha256').update(sessionId).digest('hex');
  }
}
