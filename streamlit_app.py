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


def get_reading(name: str, date_str: str, time_str: str, place: str, direction: str, snapshot: dict):
    api_key = os.getenv('DEEPSEEK_API_KEY')
    model = os.getenv('DEEPSEEK_MODEL', 'deepseek-chat')
    if not api_key:
        raise RuntimeError('Set DEEPSEEK_API_KEY before running Streamlit app.')

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

Calculated snapshot:
Lagna: {snapshot['lagna_sign']} (lord: {snapshot['lagna_lord']})
Moon sign: {snapshot['moon_sign']}
LST: {snapshot['lst']}
Asc longitude: {snapshot['asc_deg']}
Moon longitude: {snapshot['moon_deg']}

Keep answer concise, compassionate, and practical."""

    res = requests.post(
        'https://api.deepseek.com/chat/completions',
        headers={'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'},
        json={
            'model': model,
            'messages': [
                {'role': 'system', 'content': 'You are an expert Vedic astrology assistant.'},
                {'role': 'user', 'content': prompt},
            ],
            'temperature': 0.5,
        },
        timeout=30,
    )
    res.raise_for_status()
    data = res.json()
    return data['choices'][0]['message']['content']


st.set_page_config(page_title='VedicJyotish Streamlit', page_icon='🔮', layout='centered')

st.markdown(
    """
    <style>
      .stApp {
        background: radial-gradient(circle at top right, #1d2a6b 0%, #0f172a 40%, #020617 100%);
      }
      .block-container {
        max-width: 900px;
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
      .vj-hero h1 {
        margin: 0;
        color: #e2e8f0;
        font-size: 1.7rem;
      }
      .vj-hero p {
        margin: 0.35rem 0 0;
        color: #cbd5e1;
      }
      .vj-chip {
        display: inline-block;
        margin-top: 0.7rem;
        padding: 0.2rem 0.55rem;
        border-radius: 999px;
        font-size: 0.76rem;
        color: #dbeafe;
        background: rgba(30, 64, 175, 0.42);
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
      <p>Fast lagna + moon approximation with a practical DeepSeek interpretation.</p>
      <span class="vj-chip">UI: streamlit-modern-v1</span>
    </div>
    """,
    unsafe_allow_html=True,
)

with st.sidebar:
    st.header('⚙️ Session Setup')
    st.caption('If values are missing, the app cannot generate a reading.')
    model_name = os.getenv('DEEPSEEK_MODEL', 'deepseek-chat')
    st.write(f'**Model:** `{model_name}`')
    st.write(f"**API key:** {'✅ Detected' if os.getenv('DEEPSEEK_API_KEY') else '❌ Missing'}")
    st.divider()
    st.caption('Tip: run with `streamlit run streamlit_app.py` and hard-refresh browser after code changes.')

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

    st.markdown('</div>', unsafe_allow_html=True)
    submitted = st.form_submit_button('Generate Prashna Chart Reading')

if submitted:
    try:
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

        with st.spinner('Running calculations, ephemeris approximation, and chart generation...'):
            reading = get_reading(name, date_val.isoformat(), time_val.strftime('%H:%M'), place, direction, snapshot)

        st.success('Reading generated successfully')
        st.subheader('Interpretation')
        st.markdown(reading)
    except Exception as err:
        st.error(str(err))
