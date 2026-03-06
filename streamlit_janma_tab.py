import math
import os
from datetime import datetime, timezone

import requests
import streamlit as st

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
PLANET_RATES = {
    'Sun': 0.985647,
    'Moon': 13.176396,
    'Mars': 0.524021,
    'Mercury': 4.092385,
    'Jupiter': 0.083092,
    'Venus': 1.602130,
    'Saturn': 0.033459,
    'Rahu': -0.052953,
    'Ketu': 0.0,
}
PLANET_BASE = {
    'Sun': 280.460,
    'Moon': 218.316,
    'Mars': 355.433,
    'Mercury': 252.251,
    'Jupiter': 34.351,
    'Venus': 181.979,
    'Saturn': 50.077,
    'Rahu': 125.044,
    'Ketu': 305.044,
}


def normalize(deg: float) -> float:
    return ((deg % 360) + 360) % 360


def sign_name(longitude: float) -> str:
    return ZODIAC_SIGNS[int(normalize(longitude) // 30)]


def to_julian_day(dt: datetime) -> float:
    return dt.timestamp() / 86400 + 2440587.5


def lahiri_ayanamsa_approx(jd: float) -> float:
    t = (jd - 2451545.0) / 36525.0
    return 22.460148 + 1.396042 * t + 0.000087 * t * t


def sidereal_planets(jd: float) -> dict[str, float]:
    d = jd - 2451545.0
    ayan = lahiri_ayanamsa_approx(jd)
    out = {}
    for planet, rate in PLANET_RATES.items():
        if planet == 'Ketu':
            out[planet] = normalize(out['Rahu'] + 180)
            continue
        tropical = normalize(PLANET_BASE[planet] + rate * d)
        out[planet] = normalize(tropical - ayan)
    out['Ketu'] = normalize(out['Rahu'] + 180)
    return out


def nakshatra_from_longitude(lon: float) -> tuple[str, int, float]:
    span = 360 / 27
    idx = int(normalize(lon) // span)
    progress = (normalize(lon) - idx * span) / span
    return NAKSHATRAS[idx], idx + 1, progress


def panchanga(sun_lon: float, moon_lon: float) -> dict[str, str]:
    tithi_idx = int(normalize(moon_lon - sun_lon) // 12) + 1
    yoga_idx = int(normalize(moon_lon + sun_lon) // (360 / 27)) + 1
    karana_idx = int(normalize(moon_lon - sun_lon) // 6) + 1
    return {
        'Tithi': f'{tithi_idx}/30',
        'Yoga': f'{yoga_idx}/27',
        'Karana': f'{karana_idx}/60',
    }


def current_vimshottari(moon_lon: float, birth_dt: datetime) -> dict[str, str]:
    nak, nak_no, progress = nakshatra_from_longitude(moon_lon)
    start_lord = VIMSHOTTARI_SEQUENCE[(nak_no - 1) % 9]
    remaining_years = VIMSHOTTARI_YEARS[start_lord] * (1 - progress)

    now = datetime.now(timezone.utc)
    elapsed_years = max(0.0, (now - birth_dt.astimezone(timezone.utc)).days / 365.2425)

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

    # Lightweight Antardasha estimate by proportional split
    antardasha_years = VIMSHOTTARI_YEARS[maha] / 9
    ant_idx = int((VIMSHOTTARI_YEARS[maha] - maha_left) // max(antardasha_years, 1e-6)) % 9
    antara = seq[(pos + ant_idx) % 9]

    return {
        'Birth Nakshatra': nak,
        'Birth Nakshatra No': str(nak_no),
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
    return yogas or ['No major simple-yoga trigger detected in starter module.']


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

    prompt = f"""You are a Vedic Jyotish assistant. Give concise Janma Kundali guidance with Sanskrit terms.
Question: {question or 'General life direction'}
Sidereal planetary longitudes: {planets}
Current dasha snapshot: {dasha}
Return: 1) Overview 2) Marriage 3) Career 4) Finance 5) Conclusion."""

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


def render_janma_kundali_tab(show_page_config: bool = True):
    if show_page_config:
        st.set_page_config(page_title='VedicJyotish Tabs', page_icon='🕉️', layout='wide')
    st.title('🕉️ VedicJyotish — Janma Kundali (Birth Chart)')
    st.subheader('Janma Kundali analysis — starter module')
    st.caption('Uses sidereal-style approximation with Lahiri ayanamsa estimate and Navagraha longitudes.')

    selected_providers = st.session_state.get('selected_providers', ['DeepSeek'])
    janma_provider_options = [p for p in selected_providers if p in ['DeepSeek', 'OpenRouter']] or ['DeepSeek', 'OpenRouter']

    c1, c2, c3 = st.columns(3)
    with c1:
        name = st.text_input('Name', placeholder='Optional')
        dob = st.date_input('Birth Date')
    with c2:
        tob = st.time_input('Birth Time')
        place = st.text_input('Birth Place', placeholder='Delhi')
    with c3:
        provider = st.selectbox('AI Provider', janma_provider_options)
        default_models = st.session_state.get(f'models_{provider}', [])
        default_model = default_models[0] if default_models else ('deepseek-chat' if provider == 'DeepSeek' else 'openai/gpt-4o-mini')
        model = st.text_input('Model', value=default_model)

    api_key = st.session_state.get(f'api_key_{provider}', '')
    if not api_key:
        st.caption('No API key set for this provider. Use the global 🔑 API button above.')
    question = st.text_area('QUESTION WRITING AREA', placeholder='Ask about marriage, career, finance, timing...')

    if st.button('Generate Janma Kundali Analysis'):
        dt = datetime.fromisoformat(f"{dob.isoformat()}T{tob.strftime('%H:%M')}")
        jd = to_julian_day(dt)
        ayan = lahiri_ayanamsa_approx(jd)
        planets = sidereal_planets(jd)
        moon_nak, nak_no, _ = nakshatra_from_longitude(planets['Moon'])
        dasha = current_vimshottari(planets['Moon'], dt.replace(tzinfo=timezone.utc))
        pan = panchanga(planets['Sun'], planets['Moon'])
        yogas = detect_simple_yogas(planets)
        focus = build_life_focus(dasha)

        st.success('Birth chart analysis generated.')
        st.markdown(f"**Name:** {name or 'Unknown'}  ")
        st.markdown(f"**Lahiri Ayanamsa (approx):** `{ayan:.4f}°`  ")
        st.markdown(f"**Moon Nakshatra:** `{moon_nak}` (#{nak_no})")

        st.markdown('### Navagraha (Sidereal Longitudes)')
        st.dataframe([
            {'Planet': p, 'Longitude': round(lon, 2), 'Sign': sign_name(lon)} for p, lon in planets.items()
        ], use_container_width=True)

        st.markdown('### Vimshottari Dasha')
        st.json(dasha)

        st.markdown('### Panchanga Elements')
        st.json(pan)

        st.markdown('### Special Yoga Detection (Starter)')
        for y in yogas:
            st.write(f'- {y}')

        st.markdown('### Progressive Life Predictions')
        st.write(f"- **Primary Focus:** {focus['Primary Focus']}")
        st.write(f"- **Guidance:** {focus['Guidance']}")

        st.markdown('### AI-Powered Vedic Guidance')
        st.markdown(ai_summary(question, planets, dasha, provider, model, api_key))

        st.markdown('### Conclusion')
        st.info(
            'This Janma Kundali starter combines Navagraha positions, Nakshatra, Panchanga, and current Dasha focus. '
            'For decisions, prioritize repeated themes across Dasha + AI guidance and act on practical remedies first.'
        )


if __name__ == '__main__':
    render_janma_kundali_tab(show_page_config=True)
