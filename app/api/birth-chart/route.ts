import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';

type BirthChartRequest = {
  name: string;
  birthDate: string;
  birthTime: string;
  birthPlace: string;
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

    if (!payload?.birthDate || !payload?.birthTime || !payload?.birthPlace) {
      return jsonResponse(
        {
          ok: false,
          code: 'INVALID_INPUT',
          message: 'birthDate, birthTime, and birthPlace are required.',
        },
        400,
        requestId
      );
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    const model = process.env.DEEPSEEK_MODEL ?? 'deepseek-chat';

    if (!apiKey) {
      return jsonResponse(
        {
          ok: false,
          code: 'MISSING_API_KEY',
          message: 'DeepSeek API key is not configured on the server.',
        },
        500,
        requestId
      );
    }

    const prompt = `Create a concise Vedic astrology summary for:\nName: ${payload.name || 'Unknown'}\nDate: ${payload.birthDate}\nTime: ${payload.birthTime}\nPlace: ${payload.birthPlace}\n\nInclude: Lagna guess, key strengths, cautions, and practical suggestions.`;

    const upstream = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
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
      console.error('[birth-chart] non-json upstream', { requestId, status: upstream.status, raw: raw.slice(0, 300) });
      return jsonResponse(
        {
          ok: false,
          code: 'UPSTREAM_BAD_GATEWAY',
          message: 'Unable to compute chart right now. Please try again in a moment.',
        },
        502,
        requestId
      );
    }

    const data = await upstream.json();

    if (!upstream.ok) {
      console.error('[birth-chart] upstream error', { requestId, status: upstream.status, data });
      return jsonResponse(
        {
          ok: false,
          code: 'UPSTREAM_ERROR',
          message: data?.error?.message || 'Upstream request failed.',
        },
        upstream.status >= 500 ? 502 : 400,
        requestId
      );
    }

    const interpretation = data?.choices?.[0]?.message?.content ?? 'No interpretation returned.';
    return jsonResponse({ ok: true, interpretation }, 200, requestId);
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
