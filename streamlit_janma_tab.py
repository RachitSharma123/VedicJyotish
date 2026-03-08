import os
from datetime import datetime, timezone

import requests
import streamlit as st
import swisseph as swe

from location_service import local_to_utc, suggest_locations

ZODIAC_SIGNS = [
    'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
    'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'
]
NAKSHATRAS = [
    'Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira', 'Ardra', 'Punarvasu', 'Pushya', 'Ashlesha',
    'Magha', 'Purva Phalguni', 'Uttara Phalguni', 'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha',
    'Mula', 'Purva Ashadha', 'Uttara Ashadha', 'Shravana', 'Dhanishta', 'Shatabhisha', 'Purva Bhadrapada',
    'Uttara Bhadrapada', 'Revati',
]
VIMSHOTTARI_SEQUENCE = ['Ketu', 'Venus', 'Sun', 'Moon', 'Mars', 'Rahu', 'Jupiter', 'Saturn', 'Mercury']
VIMSHOTTARI_YEARS = {
    'Ketu': 7, 'Venus': 20, 'Sun': 6, 'Moon': 10, 'Mars': 7, 'Rahu': 18, 'Jupiter': 16, 'Saturn': 19, 'Mercury': 17,
}

PLANET_IDS = {
    'Sun': swe.SUN,
    'Moon': swe.MOON,
    'Mars': swe.MARS,
    'Mercury': swe.MERCURY,
    'Jupiter': swe.JUPITER,
    'Venus': swe.VENUS,
    'Saturn': swe.SATURN,
    'Rahu': swe.MEAN_NODE,
}


def normalize(deg: float) -> float:
    return ((deg % 360) + 360) % 360


def sign_name(longitude: float) -> str:
    return ZODIAC_SIGNS[int(normalize(longitude) // 30)]


def nakshatra_from_longitude(lon: float) -> tuple[str, int, float, int]:
    span = 360 / 27
    idx = int(normalize(lon) // span)
    progress = (normalize(lon) - idx * span) / span
    pada = int(progress * 4) + 1
    return NAKSHATRAS[idx], idx + 1, progress, min(4, max(1, pada))


def panchanga(sun_lon: float, moon_lon: float) -> dict[str, str]:
    tithi_idx = int(normalize(moon_lon - sun_lon) // 12) + 1
    yoga_idx = int(normalize(moon_lon + sun_lon) // (360 / 27)) + 1
    karana_idx = int(normalize(moon_lon - sun_lon) // 6) + 1
    return {
        'Tithi': f'{tithi_idx}/30',
        'Yoga': f'{yoga_idx}/27',
        'Karana': f'{karana_idx}/60',
    }


def current_vimshottari(moon_lon: float, birth_dt_utc: datetime) -> dict[str, str]:
    nak, nak_no, progress, _ = nakshatra_from_longitude(moon_lon)
    start_lord = VIMSHOTTARI_SEQUENCE[(nak_no - 1) % 9]
    remaining_years = VIMSHOTTARI_YEARS[start_lord] * (1 - progress)

    now = datetime.now(timezone.utc)
    elapsed_years = max(0.0, (now - birth_dt_utc).days / 365.2425)

    seq = VIMSHOTTARI_SEQUENCE
    pos = seq.index(start_lord)
    if elapsed_years <= remaining_years:
        maha = start_lord
        maha_left = remaining_years - elapsed_years
    else:
        elapsed_years -= remaining_years
        pos = (pos + 1) % 9
        while elapsed_years > VIMSHOTTARI_YEARS[seq[pos]]:
            elapsed_years -= VIMSHOTTARI_YEARS[seq[pos]]
            pos = (pos + 1) % 9
        maha = seq[pos]
        maha_left = VIMSHOTTARI_YEARS[maha] - elapsed_years

    antardasha_years = VIMSHOTTARI_YEARS[maha] / 9
    ant_idx = int((VIMSHOTTARI_YEARS[maha] - maha_left) // max(antardasha_years, 1e-6)) % 9
    antara = seq[(pos + ant_idx) % 9]

    return {
        'Birth Nakshatra': nak,
        'Mahadasha (Current)': maha,
        'Antardasha (Approx)': antara,
        'Mahadasha Remaining (Years)': f'{maha_left:.2f}',
    }


def detect_simple_yogas(planets: dict[str, float]) -> list[str]:
    yogas = []
    if sign_name(planets['Jupiter']) == sign_name(planets['Moon']):
        yogas.append('Gaja-Kesari tendency (Moon-Jupiter sign linkage)')
    if sign_name(planets['Venus']) == 'Pisces':
        yogas.append('Venus exaltation tendency')
    if sign_name(planets['Sun']) == 'Aries':
        yogas.append('Sun exaltation tendency')
    return yogas or ['No major simple-yoga trigger detected.']


def build_life_focus(dasha: dict[str, str]) -> dict[str, str]:
    maha = dasha['Mahadasha (Current)']
    lookup = {
        'Venus': ('Marriage', 'Favors relationship consolidation and comforts.'),
        'Mars': ('Career', 'Action-oriented period; watch impatience in decisions.'),
        'Jupiter': ('Finance', 'Expansion and advisory support can improve outcomes.'),
        'Saturn': ('Career', 'Slow, steady growth through discipline and duty.'),
        'Moon': ('Marriage', 'Emotional priorities and family needs rise.'),
        'Mercury': ('Finance', 'Commerce, skills, and negotiations become central.'),
        'Sun': ('Career', 'Visibility, authority, and leadership themes strengthen.'),
        'Rahu': ('Finance', 'Unconventional opportunities; use risk controls.'),
        'Ketu': ('Marriage', 'Detachment period; clarity in values is important.'),
    }
    area, note = lookup.get(maha, ('Career', 'Balanced period; focus on fundamentals.'))
    return {'Primary Focus': area, 'Guidance': note}


def ai_summary(question: str, planets: dict[str, float], dasha: dict[str, str], provider: str, model: str, api_key: str) -> str:
    cfg = {
        'DeepSeek': ('https://api.deepseek.com/chat/completions', 'DEEPSEEK_API_KEY'),
        'OpenRouter': ('https://openrouter.ai/api/v1/chat/completions', 'OPENROUTER_API_KEY'),
    }
    if provider not in cfg:
        return 'AI summary skipped: unsupported provider selected for this starter tab.'

    endpoint, env_key = cfg[provider]
    api_key = (api_key or os.getenv(env_key, '')).strip()
    if not api_key:
        return f'AI summary skipped: missing API key for {provider}.'

    prompt = f"""You are a Vedic Jyotish assistant. Use focus-based practical guidance.
Question: {question or 'General life direction'}
Sidereal planetary longitudes: {planets}
Current dasha snapshot: {dasha}
Return: 1) Overview 2) Marriage 3) Career 4) Finance 5) Health 6) Conclusion."""

    headers = {'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'}
    if provider == 'OpenRouter':
        headers['HTTP-Referer'] = 'http://localhost'
        headers['X-Title'] = 'VedicJyotish Janma Tab'

    try:
        res = requests.post(
            endpoint,
            headers=headers,
            json={
                'model': model,
                'messages': [
                    {'role': 'system', 'content': 'You are an expert Vedic astrology assistant.'},
                    {'role': 'user', 'content': prompt},
                ],
                'temperature': 0.4,
            },
            timeout=45,
        )
        res.raise_for_status()
        data = res.json()
        return data['choices'][0]['message']['content']
    except requests.exceptions.Timeout:
        return f'{provider} timeout for model {model}. Please retry or switch model.'
    except Exception as exc:
        return f'AI summary error: {exc}'


def swiss_sidereal_chart(dt_utc: datetime, lat: float, lon: float) -> tuple[dict[str, float], float, float]:
    hour = dt_utc.hour + dt_utc.minute / 60 + dt_utc.second / 3600
    jd = swe.julday(dt_utc.year, dt_utc.month, dt_utc.day, hour)

    swe.set_sid_mode(swe.SIDM_LAHIRI)
    flags = swe.FLG_SWIEPH | swe.FLG_SIDEREAL

    planets: dict[str, float] = {}
    for name, pid in PLANET_IDS.items():
        lon_val = swe.calc_ut(jd, pid, flags)[0][0]
        planets[name] = normalize(lon_val)
    planets['Ketu'] = normalize(planets['Rahu'] + 180)

    houses = swe.houses_ex(jd, lat, lon, b'P', flags)
    asc = normalize(houses[1][0])
    ayan = swe.get_ayanamsa_ut(jd)
    return planets, asc, ayan


def render_janma_kundali_tab(show_page_config: bool = True):
    if show_page_config:
        st.set_page_config(page_title='VedicJyotish Tabs', page_icon='🕉️', layout='wide')

    st.title('🕉️ VedicJyotish — Janma Kundali (Birth Chart)')
    st.subheader('Janma Kundali analysis — Swiss Ephemeris based starter module')

    selected_providers = st.session_state.get('selected_providers', ['DeepSeek'])
    janma_provider_options = [p for p in selected_providers if p in ['DeepSeek', 'OpenRouter']] or ['DeepSeek', 'OpenRouter']

    c1, c2, c3 = st.columns(3)
    with c1:
        name = st.text_input('Name', placeholder='Optional')
        dob_input = st.text_input('Birth Date (DD/MM/YYYY)', value=datetime.now().strftime('%d/%m/%Y'))
    with c2:
        tob = st.time_input('Birth Time')
        place_query = st.text_input('Place of Birth', placeholder='Type city/place name')
        if st.button('Suggest Locations', key='suggest_location_btn'):
            st.session_state['location_suggestions'] = suggest_locations(place_query)

        suggestions = st.session_state.get('location_suggestions', [])
        selected_label = st.selectbox('Suggested Locations', ['Select...'] + [s['label'] for s in suggestions], key='location_pick')
        selected = next((s for s in suggestions if s['label'] == selected_label), None)

        lat_default = float(selected['lat']) if selected else 28.6139
        lon_default = float(selected['lon']) if selected else 77.2090
        tz_default = str(selected['timezone']) if selected else 'Asia/Kolkata'

        lat = st.number_input('Latitude', value=lat_default, format='%.6f')
        lon = st.number_input('Longitude', value=lon_default, format='%.6f')
        tz_name = st.text_input('Timezone', value=tz_default, help='IANA timezone, e.g., Asia/Kolkata, Australia/Melbourne')

    with c3:
        provider = st.selectbox('AI Provider', janma_provider_options)
        default_models = st.session_state.get(f'models_{provider}', [])
        default_model = default_models[0] if default_models else ('deepseek-chat' if provider == 'DeepSeek' else 'openai/gpt-4o-mini')
        model = st.text_input('Model', value=default_model)

    api_key = st.session_state.get(f'api_key_{provider}', '')
    if not api_key:
        st.caption('No API key set for this provider. Use the global 🔑 API button above.')

    question = st.text_area('QUESTION WRITING AREA', placeholder='Ask about career, marriage, health, finance, timing...')

    parsed_dob = None
    try:
        parsed_dob = datetime.strptime((dob_input or '').strip(), '%d/%m/%Y').date()
    except ValueError:
        st.error('Please enter Birth Date in DD/MM/YYYY format (example: 24/10/1995).')

    if st.button('Generate Janma Kundali Analysis'):
        if parsed_dob is None:
            st.stop()

        dt_local = datetime.fromisoformat(f"{parsed_dob.isoformat()}T{tob.strftime('%H:%M')}")
        dt_utc = local_to_utc(dt_local, (tz_name or 'UTC').strip())

        planets, asc, ayan = swiss_sidereal_chart(dt_utc, lat, lon)
        moon_nak, nak_no, _, pada = nakshatra_from_longitude(planets['Moon'])
        dasha = current_vimshottari(planets['Moon'], dt_utc)
        pan = panchanga(planets['Sun'], planets['Moon'])
        yogas = detect_simple_yogas(planets)
        focus = build_life_focus(dasha)

        st.success('Birth chart analysis generated.')
        st.markdown(f"**Name:** {name or 'Unknown'}")
        st.markdown(f"**Local Birth Time:** `{dt_local}` | **UTC:** `{dt_utc}`")
        st.markdown(f"**Resolved Coordinates:** `{lat:.4f}, {lon:.4f}` | **Timezone:** `{tz_name}`")
        st.markdown(f"**Lahiri Ayanamsa:** `{ayan:.4f}°` | **Ascendant:** `{asc:.2f}° ({sign_name(asc)})`")
        st.markdown(f"**Moon Nakshatra:** `{moon_nak}` (#{nak_no}), **Pada:** `{pada}`")

        st.markdown('### Navagraha (Sidereal Longitudes)')
        st.dataframe(
            [{'Planet': p, 'Longitude': round(lon_val, 4), 'Sign': sign_name(lon_val)} for p, lon_val in planets.items()],
            use_container_width=True,
        )

        st.markdown('### Dasha & Panchanga')
        dasha_rows = [{'Metric': k, 'Value': v} for k, v in dasha.items()]
        pan_rows = [{'Metric': k, 'Value': v} for k, v in pan.items()]
        d1, d2 = st.columns(2)
        d1.table(dasha_rows)
        d2.table(pan_rows)

        st.markdown('### Focus-based Interpretation')
        st.write(f"- **Primary Focus:** {focus['Primary Focus']}")
        st.write(f"- **Guidance:** {focus['Guidance']}")

        st.markdown('### Basic Yoga Detection')
        for y in yogas:
            st.write(f'- {y}')

        st.markdown('### AI Summary (Focus-Aware)')
        st.markdown(ai_summary(question, planets, dasha, provider, model, api_key))


if __name__ == '__main__':
    render_janma_kundali_tab(show_page_config=True)
