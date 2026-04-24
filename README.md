# Prashna Oracle ✦

**AI-powered Vedic astrology engine for Prashna Kundali readings.**

Ask any question. The oracle calculates your Lagna, Moon sign, and all 9 Navagrahas using sidereal Lahiri ayanamsha — then delivers a full Jyotish interpretation powered by Mistral Large 675B via NVIDIA NIM.

---

## Features

- **Prashna Kundali** — Ascendant + Moon computed from the exact moment of your question
- **Full 9-Graha Ephemeris** — Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn, Rahu, Ketu with nakshatra + pada
- **AI Interpretation** — Mistral Large 3 (675B) via NVIDIA NIM
- **No API key required from the user** — server-side key injection
- **Space canvas background** — nebula clouds, 380 stars, shooting stars, galaxy core glow
- **Liquid Glass UI** — framer-motion animations, ambient blobs, spring physics
- **Viewport-locked layout** — no page scroll, panels scroll internally
- **Dark/Light mode**

---

## Stack

- **Next.js 16** (App Router)
- **Framer Motion** — animations
- **Lucide React** — icons
- **Tailwind CSS v4** + shadcn/ui components
- **NVIDIA NIM** — LLM inference

---

## Setup

```bash
npm install
```

Create `.env.local`:

```env
NVIDIA_API_KEY=your_nvidia_nim_key
```

Get your key at [build.nvidia.com](https://build.nvidia.com/models).

Run:

```bash
npm run dev
# open http://localhost:3000
```

---

## Available Models (NVIDIA NIM)

Swap model in `app/page.tsx` and `app/lib/providers.ts`:

| Model | Params | Notes |
|---|---|---|
| `mistralai/mistral-large-3-675b-instruct-2512` | 675B | Default — best quality |
| `meta/llama-3.1-405b-instruct` | 405B | Fast + capable |
| `minimaxai/minimax-m2.7` | ~456B MoE | Multilingual |
| `qwen/qwen3.5-122b-a10b` | 122B MoE | Fast |
| `nvidia/llama-3.3-nemotron-super-49b-v1` | 49B | Lightweight |

---

## API

`POST /api/birth-chart`

```json
{
  "birthDate": "2026-04-24",
  "birthTime": "18:59",
  "birthPlace": "Melbourne, Australia",
  "question": "Will my nephew recover?",
  "name": "Optional",
  "direction": "North"
}
```

---

## License

MIT
