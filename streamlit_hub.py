import streamlit as st

from janma_requirements import get_glossary_terms


def run_hub():
    from streamlit_app import PROVIDERS, fetch_models, render_prashna_app
    from streamlit_janma_tab import render_janma_kundali_tab

    st.set_page_config(page_title='VedicJyotish Hub', page_icon='🕉️', layout='wide')

    if 'mode' not in st.session_state:
        st.session_state['mode'] = 'Prashna Reading'

    if 'selected_providers' not in st.session_state:
        st.session_state['selected_providers'] = ['DeepSeek']

    if 'show_glossary_page' not in st.session_state:
        st.session_state['show_glossary_page'] = False

    st.markdown(
        """
        <style>
          .st-key-api_btn button {
            width: 100%;
            min-height: 3rem;
            border-radius: 12px;
            font-size: 1.35rem;
            padding: 0.25rem 0.5rem;
            border: 1px solid rgba(148,163,184,.65);
            background: rgba(15,23,42,.78);
          }
          .st-key-api_btn button:hover {
            border-color: rgba(226,232,240,.95);
            background: rgba(30,41,59,.95);
          }
          .info-pop {
            border: 1px solid rgba(148,163,184,.45);
            background: rgba(15,23,42,.95);
            border-radius: 12px;
            padding: 0.8rem 1rem;
            margin: 0.6rem 0 1rem;
            max-width: none;
            width: 100%;
            box-shadow: 0 10px 25px rgba(2, 6, 23, .45);
          }
          .info-pop h4 { margin: 0 0 .35rem 0; color: #e2e8f0; }
          .info-pop ul { margin: 0; padding-left: 1rem; }
          .info-pop li { color: #cbd5e1; margin: .15rem 0; font-size: .92rem; }
        </style>
        """,
        unsafe_allow_html=True,
    )

    st.caption('UI Build: streamlit-hub-v3')

    def render_global_api_controls():
        with st.expander('🔑 API Setup', expanded=st.session_state.get('show_api_form', False)):
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
                    api_key = st.text_input(
                        f'{provider_name} API Key',
                        value=st.session_state.get(api_key_state_key, ''),
                        type='password',
                        key=f'global_input_{api_key_state_key}',
                    )
                    st.session_state[api_key_state_key] = api_key

                    model_options = list(st.session_state.get(f'available_{provider_name}', cfg['default_models']))
                    saved_defaults = st.session_state.get(model_state_key, cfg['default_models'][:1])

                    # Prevent StreamlitAPIException: default items must exist in options.
                    safe_defaults = [m for m in saved_defaults if m in model_options]
                    if not safe_defaults:
                        safe_defaults = model_options[:1]

                    selected_models = st.multiselect(
                        f'{provider_name} Models',
                        options=model_options,
                        default=safe_defaults,
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

            if st.button('✅ Verify & Hide API Form', use_container_width=True):
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

    with st.sidebar:
        st.markdown('### Quick Tools')
        if st.button('📚', key='glossary_btn', help='Open/close glossary dictionary', use_container_width=True):
            st.session_state['show_glossary_page'] = not st.session_state.get('show_glossary_page', False)

    mode = st.radio('Module', ['Prashna Reading', 'Janma Kundali'], horizontal=True, key='mode')
    tool_api, _ = st.columns([1, 9])
    with tool_api:
        if st.button('🔑', key='api_btn', help='Open/close global API setup', use_container_width=True):
            st.session_state['show_api_form'] = not st.session_state.get('show_api_form', False)

    if st.session_state.get('show_glossary_page', False):
        st.markdown('### 📚 Glossary Dictionary')
        st.caption('Hindi/Sanskrit Jyotish terms explained in simple language.')
        glossary_rows = [{'Word': word, 'Meaning': meaning} for word, meaning in get_glossary_terms()]
        st.dataframe(glossary_rows, use_container_width=True)

    if st.session_state.get('show_api_form', False):
        render_global_api_controls()

    if mode == 'Prashna Reading':
        render_prashna_app(show_page_config=False)
    else:
        render_janma_kundali_tab(show_page_config=False)


if __name__ == "__main__":
    run_hub()
