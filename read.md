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

## 3) Set DeepSeek API key

```bash
export DEEPSEEK_API_KEY="your_key_here"
# optional model override
export DEEPSEEK_MODEL="deepseek-chat"
```

## 4) Force-refresh and clear stale app state

If UI still looks old:

1. Stop the Streamlit process.
2. Start it again with `streamlit run streamlit_app.py`.
3. In browser, hard refresh (`Ctrl+Shift+R` or `Cmd+Shift+R`).
4. If needed, open in an incognito window.

## 5) Confirm you are seeing the new UI

You should now see:

- A glass-style hero block with title "🔮 VedicJyotish — Prashna Reading"
- A badge `UI: streamlit-modern-v1`
- A sidebar section named `⚙️ Session Setup`
- Snapshot metrics cards (Lagna, Lagna Lord, Moon Sign, etc.)

## 6) Common reason changes don't appear

- Running a different file than `streamlit_app.py`
- Multiple Streamlit processes using different ports
- Browser caching old frontend assets
- Editing one Python environment and running another

## Quick check command

```bash
ps aux | rg "streamlit run"
```

This helps verify whether multiple Streamlit apps are running at once.
