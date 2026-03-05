import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { type AIProvider, normalizeModelsPayload, PROVIDERS } from '../../lib/providers';

type ModelsRequest = {
  provider: AIProvider;
  apiKey?: string;
};

function jsonResponse(body: unknown, status: number, requestId: string) {
  return NextResponse.json(body, {
    status,
    headers: {
      'x-request-id': requestId,
      'cache-control': 'no-store',
    },
  });
}

export async function POST(req: Request) {
  const requestId = req.headers.get('x-request-id') ?? randomUUID();

  try {
    const payload = (await req.json()) as Partial<ModelsRequest>;
    if (!payload.provider || !(payload.provider in PROVIDERS)) {
      return jsonResponse({ ok: false, message: 'Valid provider is required.' }, 400, requestId);
    }

    const config = PROVIDERS[payload.provider];
    const serverKey = config.keyEnv ? process.env[config.keyEnv] : undefined;
    const apiKey = payload.apiKey || serverKey;

    const headers: HeadersInit = { Accept: 'application/json' };
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }

    if (payload.provider === 'openrouter') {
      headers['HTTP-Referer'] = 'https://vedicjyotish.local';
      headers['X-Title'] = 'VedicJyotish';
    }

    const upstream = await fetch(config.modelsUrl, { headers });
    const contentType = upstream.headers.get('content-type') ?? '';

    if (!contentType.toLowerCase().includes('application/json')) {
      const raw = await upstream.text();
      return jsonResponse(
        { ok: false, message: `Non-JSON response from ${config.label}: ${raw.slice(0, 180)}` },
        502,
        requestId
      );
    }

    const data = await upstream.json();
    if (!upstream.ok) {
      return jsonResponse(
        { ok: false, message: data?.error?.message || `${config.label} model list request failed.` },
        upstream.status,
        requestId
      );
    }

    const models = normalizeModelsPayload(data);
    return jsonResponse({ ok: true, models, defaultModel: config.defaultModel }, 200, requestId);
  } catch {
    return jsonResponse({ ok: false, message: 'Unable to fetch model list.' }, 500, requestId);
  }
}
