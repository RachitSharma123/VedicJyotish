# VedicJyotish

A minimal Next.js app that generates a Vedic birth-chart style summary through a server-side DeepSeek proxy route.

## Setup

1. Copy env file and set your key:
   - `cp .env.example .env.local`
   - set `DEEPSEEK_API_KEY` in `.env.local`
2. Run dev server: `npm run dev`
3. Open `http://localhost:3000`

## Improvements implemented

- Robust API JSON handling to avoid parsing HTML error pages as JSON.
- Retry + timeout behavior in client fetch helper.
- Server route that always returns JSON and exposes `x-request-id` for debugging.
- Dark mode toggle with persisted preference.

## Notes

- Do **not** hardcode API keys in source.
- Use `DEEPSEEK_MODEL` to switch to the latest model available in your DeepSeek account.
