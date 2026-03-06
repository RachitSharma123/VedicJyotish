import streamlit as st

from streamlit_app import render_prashna_app
from streamlit_janma_tab import render_janma_kundali_tab

st.set_page_config(page_title='VedicJyotish Hub', page_icon='🕉️', layout='wide')

st.markdown(
    """
    <style>
      .info-pop {
        border: 1px solid rgba(148,163,184,.35);
        background: rgba(15,23,42,.72);
        border-radius: 12px;
        padding: 0.8rem 1rem;
        margin: 0.6rem 0 1rem;
      }
      .info-pop h4 { margin: 0 0 .35rem 0; color: #e2e8f0; }
      .info-pop ul { margin: 0; padding-left: 1rem; }
      .info-pop li { color: #cbd5e1; margin: .15rem 0; }
    </style>
    """,
    unsafe_allow_html=True,
)

c1, c2, _ = st.columns([2, 1, 5])
with c1:
    mode = st.radio('Module', ['Prashna Reading', 'Janma Kundali'], horizontal=True)
with c2:
    if st.button('ℹ️ Info', use_container_width=True):
        st.session_state['show_glossary'] = not st.session_state.get('show_glossary', False)

if st.session_state.get('show_glossary', False):
    st.markdown(
        """
        <div class="info-pop">
          <h4>Glossary (Sanskrit / Hindi terms)</h4>
          <ul>
            <li><b>Janma Kundali</b>: Birth chart.</li>
            <li><b>Lagna</b>: Ascendant sign at birth time.</li>
            <li><b>Nakshatra</b>: Lunar mansion (27 divisions).</li>
            <li><b>Panchanga</b>: Tithi, Vara, Nakshatra, Yoga, Karana framework.</li>
            <li><b>Vimshottari Dasha</b>: Planetary timing cycles.</li>
            <li><b>Mahadasha / Antardasha / Pratyantardasha</b>: Major/sub/sub-sub planetary periods.</li>
            <li><b>Ayanamsa</b>: Tropical–sidereal offset (Lahiri used in this app).</li>
            <li><b>Navagraha</b>: Nine planetary indicators used in Jyotish.</li>
            <li><b>Yoga</b>: Special planetary combinations indicating patterns.</li>
          </ul>
        </div>
        """,
        unsafe_allow_html=True,
    )

if mode == 'Prashna Reading':
    render_prashna_app(show_page_config=False)
else:
    render_janma_kundali_tab(show_page_config=False)
