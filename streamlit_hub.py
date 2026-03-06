import re
import time

import streamlit as st

from streamlit_app import PROVIDERS, fetch_models, render_prashna_app
from streamlit_janma_tab import render_janma_kundali_tab

st.set_page_config(page_title='VedicJyotish Hub', page_icon='🕉️', layout='wide')

JANMA_REQUEST_PATTERN = re.compile(r'\b(janma|janam|janma\s+kundali|birth\s+chart|natal)\b', re.IGNORECASE)

if 'mode' not in st.session_state:
    st.session_state['mode'] = 'Prashna Reading'

if 'selected_providers' not in st.session_state:
    st.session_state['selected_providers'] = ['DeepSeek']

st.markdown(
    """
    <style>
      .st-key-info_btn button, .st-key-api_btn button {
        width: 2.2rem;
        height: 2.2rem;
        border-radius: 999px;
        font-size: 0.9rem;
        padding: 0;
        border: 1px solid rgba(148,163,184,.55);
        background: rgba(15,23,42,.75);
      }
      .st-key-info_btn button:hover, .st-key-api_btn button:hover {
        border-color: rgba(226,232,240,.9);
        background: rgba(30,41,59,.95);
      }
      .info-pop {
        border: 1px solid rgba(148,163,184,.45);
        background: rgba(15,23,42,.95);
        border-radius: 12px;
        padding: 0.8rem 1rem;
        margin: 0.6rem 0 1rem;
        max-width: 560px;
        box-shadow: 0 10px 25px rgba(2, 6, 23, .45);
      }
      .info-pop h4 { margin: 0 0 .35rem 0; color: #e2e8f0; }
      .info-pop ul { margin: 0; padding-left: 1rem; }
      .info-pop li { color: #cbd5e1; margin: .15rem 0; font-size: .92rem; }
    </style>
    """,
    unsafe_allow_html=True,
)


def render_global_info():
    if st.button('ℹ️', key='info_btn', help='Quick glossary for Hindi/Sanskrit words', use_container_width=True):
        st.session_state['show_glossary'] = not st.session_state.get('show_glossary', False)
        if st.session_state['show_glossary']:
            st.session_state['glossary_opened_at'] = time.time()

    opened_at = st.session_state.get('glossary_opened_at')
    if st.session_state.get('show_glossary', False) and opened_at and (time.time() - opened_at > 20):
        st.session_state['show_glossary'] = False

    if st.session_state.get('show_glossary', False):
        st.markdown(
            """
            <div class="info-pop">
              <h4>Glossary for non-English users (auto-hides after ~20s)</h4>
              <ul>
                <li><b>Janma Kundali</b>: Birth chart (जन्म कुंडली).</li>
                <li><b>Lagna</b>: Ascendant sign at birth time (लग्न).</li>
                <li><b>Nakshatra</b>: Lunar mansion (नक्षत्र).</li>
                <li><b>Panchanga</b>: Tithi, Vara, Nakshatra, Yoga, Karana framework (पंचांग).</li>
                <li><b>Vimshottari Dasha</b>: Planetary timing cycles (विंशोत्तरी दशा).</li>
                <li><b>Ayanamsa</b>: Tropical–sidereal offset (अयनांश).</li>
                <li><b>Navagraha</b>: Nine planetary indicators used in Jyotish (नवग्रह).</li>
              </ul>
            </div>
            """,
            unsafe_allow_html=True,
        )


def render_global_api_controls():
    with st.expander('🔑 API', expanded=st.session_state.get('show_api_form', False)):
        st.caption('Global API setup: works for Prashna + Janma pages.')
        selected_providers = st.multiselect(
            'Providers',
            options=list(PROVIDERS.keys()),
            default=st.session_state.get('selected_providers', ['DeepSeek']),
            key='global_selected_providers',
        )
        st.session_state['selected_providers'] = selected_providers

        for provider_name in selected_providers:
            cfg = PROVIDERS[provider_name]
            api_key_state_key = f"api_key_{provider_name}"
            model_state_key = f"models_{provider_name}"

            with st.container(border=True):
                st.markdown(f'**{provider_name}**')
                default_api_key = st.session_state.get(api_key_state_key, '')
                api_key = st.text_input(
                    f'{provider_name} API Key',
                    value=default_api_key,
                    type='password',
                    key=f'global_input_{api_key_state_key}',
                )
                st.session_state[api_key_state_key] = api_key

                model_options = st.session_state.get(f'available_{provider_name}', cfg['default_models'])
                selected_models = st.multiselect(
                    f'{provider_name} Models',
                    options=model_options,
                    default=st.session_state.get(model_state_key, cfg['default_models'][:1]),
                    key=f'global_pick_{model_state_key}',
                )
                custom_model = st.text_input(
                    f'{provider_name} Custom model (optional)',
                    value='',
                    key=f'global_custom_{provider_name}',
                ).strip()
                if custom_model and custom_model not in selected_models:
                    selected_models = selected_models + [custom_model]

                if st.button(f'Fetch {provider_name} models', key=f'global_fetch_{provider_name}'):
                    try:
                        if not api_key.strip():
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
                st.write(f"API key status: {'✅ Added' if api_key.strip() else '❌ Missing'} | Models: {len(selected_models)}")

        verified = st.button('✅ Verify & Hide API Form', use_container_width=True)
        if verified:
            missing = []
            for provider_name in selected_providers:
                if not st.session_state.get(f'api_key_{provider_name}', '').strip():
                    missing.append(f'{provider_name}: key missing')
                if not st.session_state.get(f'models_{provider_name}', []):
                    missing.append(f'{provider_name}: no model selected')
            if missing:
                st.error('Please complete setup first: ' + '; '.join(missing))
            else:
                st.session_state['show_api_form'] = False
                st.success('API setup verified. Form will auto-hide.')
                st.rerun()


header_col, info_col, api_col = st.columns([7, 1, 1])
with header_col:
    mode = st.radio('Module', ['Prashna Reading', 'Janma Kundali'], horizontal=True, key='mode')
with info_col:
    st.write('')
    render_global_info()
with api_col:
    st.write('')
    if st.button('🔑', key='api_btn', help='Open/close API setup', use_container_width=True):
        st.session_state['show_api_form'] = not st.session_state.get('show_api_form', False)

if st.session_state.get('show_api_form', False):
    render_global_api_controls()

intent = st.text_input('What do you want to do?', placeholder='Example: I want Janma Kundali')
if intent and JANMA_REQUEST_PATTERN.search(intent):
    st.session_state['mode'] = 'Janma Kundali'
    mode = 'Janma Kundali'
    st.success('Switched to Janma Kundali module based on your request.')

if mode == 'Prashna Reading':
    render_prashna_app(show_page_config=False)
else:
    render_janma_kundali_tab(show_page_config=False)
