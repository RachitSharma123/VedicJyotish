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


## Streamlit option

You can also run a Streamlit version of the same prashna workflow:

1. `python -m venv .venv && source .venv/bin/activate`
2. `pip install -r requirements-streamlit.txt`
3. `export DEEPSEEK_API_KEY=...`
4. `streamlit run streamlit_app.py`

This includes time/date/location/direction capture, lagna + moon approximation, and DeepSeek reading generation.


## Provider support

The UI now accepts API keys per session and supports provider/model selection for:
- DeepSeek
- OpenRouter
- Kimi (Moonshot)

Use **Fetch Models** to pull live model IDs from provider APIs.


## Avoiding merge conflicts on generated files

If you were repeatedly seeing merge conflicts and not seeing latest changes clearly, the common culprit was `next-env.d.ts` churn between dev/build runs.

This repo now configures a merge strategy for that generated file in `.gitattributes` so normal branch merges are smoother.

Recommended workflow:
1. `git fetch origin`
2. `git pull --rebase`
3. If you still have local generated-file noise: `git checkout -- next-env.d.ts`
4. Re-run: `npm run dev`


## UI visibility checklist

If you think UI changes are missing, verify you can see these items at the top of the page:
- `API Provider Section` pill
- `Question Area` pill
- `Theme Toggle` pill
- `UI: prashna-ui-v2` badge

Then run:
1. `rm -rf .next`
2. `npm run dev`
3. hard refresh browser (`Ctrl/Cmd + Shift + R`)
