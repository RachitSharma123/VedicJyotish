# Streamlit UI Changes Guide (VedicJyotish)

If you are not seeing UI updates when running the Streamlit app, use this exact flow.

## 1) Run the correct file

```bash
streamlit run streamlit_app.py
```

This repo's Streamlit entry file is `streamlit_app.py` (not `streamlit.py`).

## 2) Install Streamlit dependencies

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements-streamlit.txt
```

## 3) API keys + providers + models (new)

In `⚙️ Session Setup` (left sidebar), you can now select:

- **Multiple providers** at once:
  - DeepSeek
  - OpenRouter
  - Z.ai (Zhipu)
  - Kimi (Moonshot)
- **Multiple models** for each selected provider
- **Provider-specific API keys**

You can also click **Fetch <provider> models** to try loading model IDs from that provider API.

## 4) Timeout error help

If you see errors like:

`HTTPSConnectionPool(host='api.deepseek.com', port=443): Read timed out.`

Try this:

1. Re-run with fewer provider/model combinations.
2. Switch to another model/provider in sidebar.
3. Retry after a short delay (provider might be rate-limited/busy).
4. Check your network/proxy/VPN.

The app now returns a friendlier timeout message telling you which provider/model timed out.

## 5) Force-refresh and clear stale app state

If UI still looks old:

1. Stop the Streamlit process.
2. Start it again with `streamlit run streamlit_app.py`.
3. In browser, hard refresh (`Ctrl+Shift+R` or `Cmd+Shift+R`).
4. If needed, open in an incognito window.

## 6) Confirm you are seeing the new UI

You should now see:

- A badge `UI: streamlit-modern-v2`
- A `Providers` multi-select in sidebar
- Per-provider API key and model selectors
- A **QUESTION WRITING AREA** box in the main form
- A **Conclusion** section shown before per-model tabs
- Tabs in output for each provider/model result

## Quick check command

```bash
ps aux | rg "streamlit run"
```

This helps verify whether multiple Streamlit apps are running at once.
