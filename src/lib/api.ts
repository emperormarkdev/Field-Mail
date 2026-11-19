import type { SendPayload } from '../types';

export class SendError extends Error {
  code: string;
  status: number;
  retryable: boolean;

  constructor(message: string, options: { code: string; status: number; retryable: boolean }) {
    super(message);
    this.name = 'SendError';
    this.code = options.code;
    this.status = options.status;
    this.retryable = options.retryable;
  }
}

interface ServerErrorShape {
  error?: { code?: string; message?: string; retryAfter?: number };
}

function isRetryable(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

export async function postPart(
  payload: SendPayload,
  accessKey?: string,
  signal?: AbortSignal,
): Promise<void> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (accessKey) {
    headers['X-Access-Key'] = accessKey;
  }

  let response: Response;
  try {
    response = await fetch('/api/send', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal,
    });
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') throw error;
    throw new SendError("Couldn't reach the sending service.", {
      code: 'network',
      status: 0,
      retryable: true,
    });
  }

  if (response.ok) return;

  let body: ServerErrorShape | null = null;
  try {
    body = (await response.json()) as ServerErrorShape;
  } catch {
    body = null;
  }

  const code = body?.error?.code ?? `http_${response.status}`;
  const message =
    body?.error?.message ??
    (response.status === 413
      ? 'This report was too large to send.'
      : `The sending service returned an error (${response.status}).`);

  throw new SendError(message, {
    code,
    status: response.status,
    retryable: isRetryable(response.status),
  });
}
