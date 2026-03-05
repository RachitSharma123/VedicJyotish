import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { generatePrashnaSnapshot } from '../../lib/astrology';
import { type AIProvider, PROVIDERS } from '../../lib/providers';

type BirthChartRequest = {
  name: string;
  birthDate: string;
  birthTime: string;
  birthPlace: string;
  direction?: string;
  question?: string;
  provider?: AIProvider;
  apiKey?: string;
  model?: string;
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
    const payload = (await req.json()) as Partial<BirthChartRequest>;

    if (!payload?.birthDate || !payload?.birthTime || !payload?.birthPlace || !payload?.question?.trim()) {
      return jsonResponse(
        {
          ok: false,
          code: 'INVALID_INPUT',
          message: 'birthDate, birthTime, birthPlace, and question are required.',
        },
        400,
        requestId
      );
    }

    const provider: AIProvider = payload.provider && payload.provider in PROVIDERS ? payload.provider : 'deepseek';
    const config = PROVIDERS[provider];

    const prashna = generatePrashnaSnapshot({
      birthDate: payload.birthDate,
      birthTime: payload.birthTime,
      birthPlace: payload.birthPlace,
      direction: payload.direction,
    });

    const serverKey = config.keyEnv ? process.env[config.keyEnv] : undefined;
    const apiKey = payload.apiKey || serverKey;
    const model = payload.model || config.defaultModel;

    if (!apiKey) {
      return jsonResponse(
        {
          ok: false,
          code: 'MISSING_API_KEY',
          message: `${config.label} API key is missing. Add it in UI or server env ${config.keyEnv}.`,
        },
        400,
        requestId
      );
    }

    const prompt = `You are a Jyotish Prashna astrologer. Capture the soul of astrology with clear structured reasoning.

Rule flow to follow strictly:
1) Note Time, Date, Location, Direction faced (if given).
2) Determine Lagna from the event moment.
3) Judge Moon for emotional truth and urgency.
4) Evaluate houses: 5/7/11 for love success and 6/8/12 for obstacles.
5) Give significators-style read: support vs delay signals.
6) Give practical timing window and next actions.

Input:
- Name: ${payload.name || 'Unknown'}
- Date: ${payload.birthDate}
- Time: ${payload.birthTime}
- Location: ${payload.birthPlace}
- Direction: ${payload.direction || 'Not provided'}
- Question: ${payload.question}

Calculated prashna snapshot (ephemeris-style approximation):
- Lagna sign: ${prashna.lagnaSign}
- Lagna lord: ${prashna.lagnaLord}
- Moon sign: ${prashna.moonSign}
- Local sidereal time: ${prashna.localSiderealTime}
- Ascendant longitude: ${prashna.rawAscendantDegrees}
- Moon longitude: ${prashna.rawMoonDegrees}
- Relevant houses: ${prashna.relevanceHouses.join(', ')}
- Obstacle houses: ${prashna.obstacleHouses.join(', ')}
- Method note: ${prashna.calculationNote}

Output format:
- Prashna Snapshot
- Lagna Meaning
- Moon Reading
- House Analysis
- Significators Verdict
- Timing Window
- Remedies / Practical Advice
Keep it insightful, compassionate, and concise.`;

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    };

    if (provider === 'openrouter') {
      headers['HTTP-Referer'] = 'https://vedicjyotish.local';
      headers['X-Title'] = 'VedicJyotish';
    }

    const upstream = await fetch(config.chatUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: 'You are an expert Vedic astrology assistant.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.5,
      }),
    });

    const contentType = upstream.headers.get('content-type') ?? '';
    if (!contentType.toLowerCase().includes('application/json')) {
      const raw = await upstream.text();
      console.error('[birth-chart] non-json upstream', {
        provider,
        requestId,
        status: upstream.status,
        raw: raw.slice(0, 300),
      });
      return jsonResponse(
        {
          ok: false,
          code: 'UPSTREAM_BAD_GATEWAY',
          message: `${config.label} returned a non-JSON response. Please retry.`,
        },
        502,
        requestId
      );
    }

    const data = await upstream.json();

    if (!upstream.ok) {
      console.error('[birth-chart] upstream error', { provider, requestId, status: upstream.status, data });
      return jsonResponse(
        {
          ok: false,
          code: 'UPSTREAM_ERROR',
          message: data?.error?.message || data?.message || `${config.label} request failed.`,
        },
        upstream.status >= 500 ? 502 : 400,
        requestId
      );
    }

    const interpretation = data?.choices?.[0]?.message?.content ?? 'No interpretation returned.';
    return jsonResponse({ ok: true, interpretation, prashna }, 200, requestId);
  } catch (error) {
    console.error('[birth-chart] unhandled', { requestId, error });
    return jsonResponse(
      {
        ok: false,
        code: 'INTERNAL_ERROR',
        message: 'An unexpected server error occurred.',
      },
      500,
      requestId
    );
  }
}
