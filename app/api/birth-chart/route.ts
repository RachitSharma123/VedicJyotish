import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { generatePrashnaSnapshot } from '../../lib/astrology';
import { type AIProvider, PROVIDERS } from '../../lib/providers';

export const maxDuration = 60;

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

    const provider: AIProvider = payload.provider && payload.provider in PROVIDERS ? payload.provider : 'nvidia';
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
          message: `${config.label} API key is missing. Add ${config.keyEnv} to server env.`,
        },
        400,
        requestId
      );
    }

    const ephemerisLines = prashna.ephemerisChart
      .map(r => `  ${r.symbol} ${r.planet.padEnd(8)} ${r.sign.padEnd(13)} ${r.degInSign.toFixed(2).padStart(6)}°  ${r.nakshatra.padEnd(18)} pada ${r.pada}${r.retrograde ? '  (R)' : ''}`)
      .join('\n');

    const prompt = `You are a Jyotish Prashna astrologer. Capture the soul of astrology with clear structured reasoning.

Rule flow to follow strictly:
1) Note Time, Date, Location, Direction faced (if given).
2) Determine Lagna from the event moment.
3) Judge Moon for emotional truth and urgency.
4) Analyse all 9 grahas from the ephemeris chart below — note sign, nakshatra, and retrograde status.
5) Evaluate houses: 5/7/11 for love success and 6/8/12 for obstacles.
6) Give significators-style read: support vs delay signals.
7) Give practical timing window and next actions.

Input:
- Name: ${payload.name || 'Unknown'}
- Date: ${payload.birthDate}
- Time: ${payload.birthTime}
- Location: ${payload.birthPlace}
- Direction: ${payload.direction || 'Not provided'}
- Question: ${payload.question}

Prashna snapshot (sidereal / Lahiri ayanamsha):
- Lagna sign: ${prashna.lagnaSign}
- Lagna lord: ${prashna.lagnaLord}
- Moon sign: ${prashna.moonSign}
- Local sidereal time: ${prashna.localSiderealTime}
- Ascendant longitude: ${prashna.rawAscendantDegrees}°
- Relevant houses: ${prashna.relevanceHouses.join(', ')}
- Obstacle houses: ${prashna.obstacleHouses.join(', ')}

Ephemeris Chart (all 9 grahas):
${ephemerisLines}

Method note: ${prashna.calculationNote}

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
        stream: true,
        max_tokens: 1200,
      }),
    });

    if (!upstream.ok) {
      const contentType = upstream.headers.get('content-type') ?? '';
      if (contentType.includes('application/json')) {
        const data = await upstream.json();
        return jsonResponse(
          { ok: false, code: 'UPSTREAM_ERROR', message: data?.error?.message || `${config.label} request failed.` },
          upstream.status >= 500 ? 502 : 400,
          requestId
        );
      }
      const raw = await upstream.text();
      return jsonResponse(
        { ok: false, code: 'UPSTREAM_ERROR', message: `${config.label} error (${upstream.status}): ${raw.slice(0, 200)}` },
        502,
        requestId
      );
    }

    const enc = new TextEncoder();
    const dec = new TextDecoder();

    const stream = new ReadableStream({
      async start(controller) {
        // First event: send prashna snapshot
        controller.enqueue(enc.encode(`event: prashna\ndata: ${JSON.stringify(prashna)}\n\n`));

        const reader = upstream.body!.getReader();
        let buf = '';

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += dec.decode(value, { stream: true });
            const lines = buf.split('\n');
            buf = lines.pop() ?? '';

            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              const raw = line.slice(6).trim();
              if (raw === '[DONE]') { controller.close(); return; }
              try {
                const json = JSON.parse(raw);
                const content = json.choices?.[0]?.delta?.content;
                if (content) {
                  controller.enqueue(enc.encode(`event: chunk\ndata: ${JSON.stringify(content)}\n\n`));
                }
              } catch { /* skip malformed chunks */ }
            }
          }
        } catch {
          controller.enqueue(enc.encode(`event: error\ndata: ${JSON.stringify('Stream interrupted')}\n\n`));
        }
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'x-request-id': requestId,
      },
    });
  } catch {
    return jsonResponse(
      { ok: false, code: 'INTERNAL_ERROR', message: 'An unexpected server error occurred.' },
      500,
      requestId
    );
  }
}
