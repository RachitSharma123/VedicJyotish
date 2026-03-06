import math
import os
from datetime import datetime

import requests
import streamlit as st

ZODIAC_SIGNS = [
    'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
    'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'
]
LAGNA_LORD = {
    'Aries': 'Mars', 'Taurus': 'Venus', 'Gemini': 'Mercury', 'Cancer': 'Moon',
    'Leo': 'Sun', 'Virgo': 'Mercury', 'Libra': 'Venus', 'Scorpio': 'Mars',
    'Sagittarius': 'Jupiter', 'Capricorn': 'Saturn', 'Aquarius': 'Saturn', 'Pisces': 'Jupiter'
}
CITY_COORDS = {
    'melbourne': (-37.8136, 144.9631), 'delhi': (28.6139, 77.2090), 'mumbai': (19.0760, 72.8777),
    'london': (51.5072, -0.1276), 'newyork': (40.7128, -74.0060), 'sydney': (-33.8688, 151.2093)
}

PROVIDERS = {
    'DeepSeek': {
        'base_url': 'https://api.deepseek.com',
        'chat_path': '/chat/completions',
        'models_path': '/models',
        'env_key': 'DEEPSEEK_API_KEY',
        'default_models': ['deepseek-chat', 'deepseek-reasoner'],
    },
    'OpenRouter': {
        'base_url': 'https://openrouter.ai/api/v1',
        'chat_path': '/chat/completions',
        'models_path': '/models',
        'env_key': 'OPENROUTER_API_KEY',
        'default_models': ['deepseek/deepseek-chat-v3-0324:free', 'openai/gpt-4o-mini'],
    },
    'Z.ai (Zhipu)': {
        'base_url': 'https://open.bigmodel.cn/api/paas/v4',
        'chat_path': '/chat/completions',
        'models_path': '/models',
        'env_key': 'ZAI_API_KEY',
        'default_models': ['glm-4-plus', 'glm-4-air'],
    },
    'Kimi (Moonshot)': {
        'base_url': 'https://api.moonshot.cn/v1',
        'chat_path': '/chat/completions',
        'models_path': '/models',
        'env_key': 'KIMI_API_KEY',
        'default_models': ['moonshot-v1-8k', 'moonshot-v1-32k'],
    },
}


def normalize_degrees(deg: float) -> float:
    return ((deg % 360) + 360) % 360


def get_sign(lon: float) -> str:
    return ZODIAC_SIGNS[int(normalize_degrees(lon) // 30)]


def to_julian_day(dt: datetime) -> float:
    return dt.timestamp() / 86400 + 2440587.5


def gmst_degrees(jd: float) -> float:
    t = (jd - 2451545.0) / 36525.0
    gmst = 280.46061837 + 360.98564736629 * (jd - 2451545) + 0.000387933 * t * t - (t * t * t) / 38710000
    return normalize_degrees(gmst)


def estimate_coords(place: str):
    normalized = ''.join(c for c in place.lower() if c.isalpha())
    for city, coords in CITY_COORDS.items():
        if city in normalized:
            return coords
    return 0.0, 77.209


def moon_longitude_approx(jd: float) -> float:
    d = jd - 2451545.0
    l0 = normalize_degrees(218.316 + 13.176396 * d)
    m_moon = normalize_degrees(134.963 + 13.064993 * d)
    lon = l0 + 6.289 * math.sin(math.radians(m_moon))
    return normalize_degrees(lon)


def build_snapshot(date_str: str, time_str: str, place: str):
    dt = datetime.fromisoformat(f"{date_str}T{time_str}")
    lat, lon = estimate_coords(place)
    jd = to_julian_day(dt)
    gmst = gmst_degrees(jd)
    lst = normalize_degrees(gmst + lon)

    epsilon = math.radians(23.4393)
    theta = math.radians(lst)
    phi = math.radians(lat)
    asc = math.degrees(math.atan2(
        math.sin(theta) * math.cos(epsilon) + math.tan(phi) * math.sin(epsilon),
        math.cos(theta)
    ))
    asc = normalize_degrees(asc)
    moon = moon_longitude_approx(jd)
    lagna_sign = get_sign(asc)

    return {
        'lagna_sign': lagna_sign,
        'lagna_lord': LAGNA_LORD[lagna_sign],
        'moon_sign': get_sign(moon),
        'lst': f"{int(lst/15):02d}:{int(((lst/15)%1)*60):02d}",
        'asc_deg': round(asc, 2),
        'moon_deg': round(moon, 2),
    }


def fetch_models(provider_name: str, api_key: str):
    cfg = PROVIDERS[provider_name]
    url = f"{cfg['base_url']}{cfg['models_path']}"
    headers = {'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'}
    if provider_name == 'OpenRouter':
        headers['HTTP-Referer'] = 'http://localhost'
        headers['X-Title'] = 'VedicJyotish Streamlit'

    res = requests.get(url, headers=headers, timeout=15)
    res.raise_for_status()
    data = res.json()

    items = data.get('data', []) if isinstance(data, dict) else []
    model_ids = []
    for item in items:
        if isinstance(item, dict) and item.get('id'):
            model_ids.append(item['id'])
    return model_ids




def build_conclusion(question: str, results: list[tuple[str, str, str]]) -> str:
    if not results:
        return 'No readings were generated.'

    takeaway_lines = []
    for provider_name, model, text in results:
        first_line = ''
        for line in text.splitlines():
            cleaned = line.strip().lstrip('-').strip()
            if cleaned:
                first_line = cleaned
                break
        if not first_line:
            first_line = 'Reading generated successfully.'
        takeaway_lines.append(f'- **{provider_name} / {model}**: {first_line}')

    question_line = question.strip() if question and question.strip() else 'General life guidance'
    return (
        f"**Question Focus:** {question_line}\n\n"
        "### Key Takeaways\n"
        + "\n".join(takeaway_lines)
        + "\n\n**Overall Conclusion:** Look for common advice repeated across providers/models and act on the practical steps first."
    )
def get_reading(
    name: str,
    date_str: str,
    time_str: str,
    place: str,
    direction: str,
    snapshot: dict,
    question: str,
    provider_name: str,
    api_key: str,
    model: str,
):
    api_key = (api_key or '').strip()
    model = (model or '').strip()
    if not api_key:
        raise RuntimeError(f'Please add API key for {provider_name} in the sidebar (Session Setup).')
    if not model:
        raise RuntimeError(f'Please select at least one model for {provider_name}.')

    prompt = f"""You are a Jyotish Prashna astrologer. Follow this flow:
1) Time, Date, Location, Direction
2) Lagna meaning
3) Moon reading
4) 5/7/11 houses and 6/8/12 obstacles
5) Significators verdict
6) Timing window and practical guidance

Input:
Name: {name or 'Unknown'}
Date: {date_str}
Time: {time_str}
Location: {place}
Direction: {direction}
Question: {question or 'General life guidance'}

Calculated snapshot:
Lagna: {snapshot['lagna_sign']} (lord: {snapshot['lagna_lord']})
Moon sign: {snapshot['moon_sign']}
LST: {snapshot['lst']}
Asc longitude: {snapshot['asc_deg']}
Moon longitude: {snapshot['moon_deg']}

Keep answer concise, compassionate, and practical."""

    cfg = PROVIDERS[provider_name]
    url = f"{cfg['base_url']}{cfg['chat_path']}"
    headers = {'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'}
    if provider_name == 'OpenRouter':
        headers['HTTP-Referer'] = 'http://localhost'
        headers['X-Title'] = 'VedicJyotish Streamlit'

    try:
        res = requests.post(
            url,
            headers=headers,
            json={
                'model': model,
                'messages': [
                    {'role': 'system', 'content': 'You are an expert Vedic astrology assistant.'},
                    {'role': 'user', 'content': prompt},
                ],
                'temperature': 0.5,
            },
            timeout=45,
        )
        res.raise_for_status()
        data = res.json()
        return data['choices'][0]['message']['content']
    except requests.exceptions.Timeout as exc:
        raise RuntimeError(
            f'{provider_name} timed out while generating reading for model `{model}`. '
            'Please retry, switch model/provider, or check network stability.'
        ) from exc
    except requests.exceptions.RequestException as exc:
        raise RuntimeError(f'{provider_name} request failed for model `{model}`: {exc}') from exc


def render_prashna_app(show_page_config: bool = True):
    if show_page_config:
        st.set_page_config(page_title='VedicJyotish Streamlit', page_icon='🔮', layout='centered')

    st.markdown(
        """
        <style>
          .stApp {
            background: radial-gradient(circle at top right, #1d2a6b 0%, #0f172a 40%, #020617 100%);
          }
          .block-container {
            max-width: 1000px;
            padding-top: 2rem;
            padding-bottom: 2rem;
          }
          .vj-hero {
            background: rgba(15, 23, 42, 0.68);
            border: 1px solid rgba(148, 163, 184, 0.3);
            border-radius: 16px;
            padding: 1.2rem 1.4rem;
            margin-bottom: 1.1rem;
            backdrop-filter: blur(8px);
          }
          .vj-hero h1 { margin: 0; color: #e2e8f0; font-size: 1.7rem; }
          .vj-hero p { margin: 0.35rem 0 0; color: #cbd5e1; }
          .vj-chip {
            display: inline-block; margin-top: 0.7rem; padding: 0.2rem 0.55rem; border-radius: 999px;
            font-size: 0.76rem; color: #dbeafe; background: rgba(30, 64, 175, 0.42);
            border: 1px solid rgba(96, 165, 250, 0.55);
          }
          .vj-card {
            border: 1px solid rgba(148, 163, 184, 0.24);
            background: rgba(15, 23, 42, 0.56);
            border-radius: 14px;
            padding: 0.9rem;
          }
        </style>
        <div class="vj-hero">
          <h1>🔮 VedicJyotish — Prashna Reading</h1>
          <p>Multi-provider + multi-model Jyotish reading with practical guidance.</p>
          <span class="vj-chip">UI: streamlit-modern-v2</span>
        </div>
        """,
        unsafe_allow_html=True,
    )

    with st.sidebar:
        st.header('⚙️ Session Setup')
        st.caption('Choose one or more providers and models. Keys are stored only in this session.')

        selected_providers = st.multiselect(
            'Providers',
            options=list(PROVIDERS.keys()),
            default=st.session_state.get('selected_providers', ['DeepSeek']),
        )
        st.session_state['selected_providers'] = selected_providers

        provider_configs = {}
        for provider_name in selected_providers:
            cfg = PROVIDERS[provider_name]
            with st.expander(provider_name, expanded=True):
                api_key_state_key = f"api_key_{provider_name}"
                model_state_key = f"models_{provider_name}"

                default_api_key = st.session_state.get(api_key_state_key, os.getenv(cfg['env_key'], ''))
                api_key = st.text_input(
                    f'{provider_name} API Key',
                    value=default_api_key,
                    type='password',
                    placeholder='Paste API key',
                    key=f'input_{api_key_state_key}',
                )
                st.session_state[api_key_state_key] = api_key

                model_options = st.session_state.get(f'available_{provider_name}', cfg['default_models'])
                selected_models = st.multiselect(
                    f'{provider_name} Models',
                    options=model_options,
                    default=st.session_state.get(model_state_key, cfg['default_models'][:1]),
                    key=f'pick_{model_state_key}',
                )
                custom_model = st.text_input(
                    f'{provider_name} Custom model (optional)',
                    value='',
                    placeholder='Type model id and press Enter',
                    key=f'custom_{provider_name}',
                ).strip()
                if custom_model and custom_model not in selected_models:
                    selected_models = selected_models + [custom_model]

                fetch_clicked = st.button(f'Fetch {provider_name} models', key=f'fetch_{provider_name}')
                if fetch_clicked:
                    try:
                        if not (api_key or '').strip():
                            st.warning(f'Add API key for {provider_name} before fetching models.')
                        else:
                            fetched = fetch_models(provider_name, api_key)
                            if fetched:
                                st.session_state[f'available_{provider_name}'] = fetched
                                st.success(f'Fetched {len(fetched)} models for {provider_name}.')
                            else:
                                st.warning(f'No models returned from {provider_name}.')
                    except Exception as fetch_err:
                        st.warning(f'Could not fetch models for {provider_name}: {fetch_err}')

                st.session_state[model_state_key] = selected_models
                st.write(f"API key status: {'✅ Added' if (api_key or '').strip() else '❌ Missing'}")
                st.write(f'Models selected: {len(selected_models)}')

                provider_configs[provider_name] = {
                    'api_key': api_key,
                    'models': selected_models,
                }

        st.divider()
        st.caption('If requests timeout, try another provider/model combination.')

    with st.form('prashna_form'):
        st.markdown('<div class="vj-card">', unsafe_allow_html=True)
        c1, c2 = st.columns(2)
        with c1:
            name = st.text_input('Name (optional)', placeholder='Your name')
            date_val = st.date_input('Date')
            place = st.text_input('Location', placeholder='Melbourne')
        with c2:
            time_val = st.time_input('Time')
            direction = st.selectbox('Direction faced', ['North', 'East', 'South', 'West', 'North-East', 'North-West', 'South-East', 'South-West'])

        question = st.text_area(
            'QUESTION WRITING AREA',
            placeholder='Write your specific question here (career, relationship, money, health, timing, etc.)',
            height=120,
        )

        st.markdown('</div>', unsafe_allow_html=True)
        submitted = st.form_submit_button('Generate Prashna Chart Reading')

    if submitted:
        try:
            if not selected_providers:
                raise RuntimeError('Please select at least one provider in the sidebar.')

            snapshot = build_snapshot(date_val.isoformat(), time_val.strftime('%H:%M'), place)
            st.subheader('Calculated Prashna Snapshot')
            m1, m2, m3 = st.columns(3)
            m1.metric('Lagna', snapshot['lagna_sign'])
            m2.metric('Lagna Lord', snapshot['lagna_lord'])
            m3.metric('Moon Sign', snapshot['moon_sign'])
            m4, m5, m6 = st.columns(3)
            m4.metric('LST', snapshot['lst'])
            m5.metric('Asc Longitude', f"{snapshot['asc_deg']}°")
            m6.metric('Moon Longitude', f"{snapshot['moon_deg']}°")

            with st.expander('Technical details', expanded=False):
                st.json(snapshot)
                st.info('Houses considered: 5/7/11 support, 6/8/12 obstacles.')

            jobs = []
            for provider_name in selected_providers:
                cfg = provider_configs.get(provider_name, {})
                api_key = cfg.get('api_key', '')
                models = cfg.get('models', [])
                if not models:
                    raise RuntimeError(f'Please select at least one model for {provider_name}.')
                for model in models:
                    jobs.append((provider_name, api_key, model))

            if len(jobs) > 8:
                st.warning('You selected many provider/model combinations; this may take longer and hit rate limits.')

            results = []
            with st.spinner('Generating readings across selected providers/models...'):
                for provider_name, api_key, model in jobs:
                    reading = get_reading(
                        name,
                        date_val.isoformat(),
                        time_val.strftime('%H:%M'),
                        place,
                        direction,
                        snapshot,
                        question,
                        provider_name,
                        api_key,
                        model,
                    )
                    results.append((provider_name, model, reading))

            st.success(f'Reading generated for {len(results)} provider/model combinations.')
            st.subheader('Conclusion')
            st.markdown(build_conclusion(question, results))

            tabs = st.tabs([f'{provider} • {model}' for provider, model, _ in results])
            for tab, (_, _, text) in zip(tabs, results):
                with tab:
                    st.subheader('Interpretation')
                    st.markdown(text)
        except Exception as err:
            st.error(str(err))


if __name__ == '__main__':
    from streamlit_janma_tab import render_janma_kundali_tab

    st.set_page_config(page_title='VedicJyotish Hub', page_icon='🕉️', layout='wide')
    st.info('Tip: the main combined app file is `streamlit_hub.py`.')
    mode = st.radio('Module', ['Prashna Reading', 'Janma Kundali'], horizontal=True)

    if mode == 'Prashna Reading':
        render_prashna_app(show_page_config=False)
    else:
        render_janma_kundali_tab(show_page_config=False)
