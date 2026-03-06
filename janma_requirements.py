from __future__ import annotations


def get_minimum_requirements() -> list[dict[str, str]]:
    """Roadmap checklist for Janma Kundali engine/features."""
    return [
        {'Feature': 'Name input', 'Status': 'Implemented'},
        {'Feature': 'Date of birth input (DD/MM/YYYY free text)', 'Status': 'Implemented'},
        {'Feature': 'Time of birth input', 'Status': 'Implemented'},
        {'Feature': 'Place of birth input', 'Status': 'Implemented'},
        {'Feature': 'Latitude and longitude lookup', 'Status': 'Planned'},
        {'Feature': 'Timezone conversion', 'Status': 'Planned'},
        {'Feature': 'Rashi chart generation', 'Status': 'Partially implemented'},
        {'Feature': 'Ascendant calculation', 'Status': 'Planned'},
        {'Feature': 'Planetary longitudes', 'Status': 'Implemented (starter approximation)'},
        {'Feature': 'Moon sign calculation', 'Status': 'Implemented'},
        {'Feature': 'Nakshatra and pada calculation', 'Status': 'Nakshatra implemented; pada planned'},
        {'Feature': 'Basic house calculation', 'Status': 'Planned'},
        {'Feature': 'Basic planet dignity', 'Status': 'Planned'},
        {'Feature': 'Vimshottari Mahadasha', 'Status': 'Implemented (starter)'},
        {'Feature': 'Antardasha', 'Status': 'Implemented (approx)'},
        {'Feature': 'Current dasha display', 'Status': 'Implemented'},
        {'Feature': 'Basic transit view', 'Status': 'Planned'},
        {'Feature': 'Navamsa chart', 'Status': 'Planned'},
        {'Feature': 'Basic Mangal dosha check', 'Status': 'Planned'},
        {'Feature': 'Basic Sade Sati check', 'Status': 'Planned'},
        {'Feature': 'Basic yoga detection', 'Status': 'Implemented (starter rules)'},
        {'Feature': 'Lagna interpretation', 'Status': 'Planned'},
        {'Feature': 'Moon sign interpretation', 'Status': 'Planned'},
        {'Feature': 'Nakshatra interpretation', 'Status': 'Planned'},
        {'Feature': 'Planet in house interpretation', 'Status': 'Planned'},
        {'Feature': 'Career summary', 'Status': 'Implemented (starter)'},
        {'Feature': 'Marriage summary', 'Status': 'Implemented (starter)'},
        {'Feature': 'Health summary', 'Status': 'Planned'},
        {'Feature': 'Wealth summary', 'Status': 'Implemented (starter finance focus)'},
        {'Feature': 'PDF export', 'Status': 'Planned'},
        {'Feature': 'User save chart option', 'Status': 'Planned'},
        {'Feature': 'Basic multilingual support', 'Status': 'Partially implemented'},
        {'Feature': 'Calculation engine using Swiss Ephemeris', 'Status': 'Planned'},
    ]


def get_glossary_terms() -> list[tuple[str, str]]:
    """Dictionary style glossary for Jyotish/Hindi/Sanskrit terms."""
    return [
        ('Janma Kundali', 'Birth chart (जन्म कुंडली).'),
        ('Lagna', 'Ascendant sign at birth time (लग्न).'),
        ('Rashi', 'Zodiac sign (राशि).'),
        ('Nakshatra', 'Lunar mansion (नक्षत्र).'),
        ('Pada', 'Quarter/division of a Nakshatra (पाद).'),
        ('Panchanga', 'Tithi, Vara, Nakshatra, Yoga, Karana framework (पंचांग).'),
        ('Vimshottari Dasha', 'Planetary timing cycles (विंशोत्तरी दशा).'),
        ('Mahadasha', 'Major planetary period (महादशा).'),
        ('Antardasha', 'Sub-period inside a Mahadasha (अंतरदशा).'),
        ('Navagraha', 'Nine planetary indicators used in Jyotish (नवग्रह).'),
        ('Ayanamsa', 'Tropical–sidereal offset (अयनांश).'),
        ('Navamsa', 'D9 divisional chart for marriage/dharma themes (नवांश).'),
        ('Mangal Dosha', 'Mars placement-related compatibility factor (मंगल दोष).'),
        ('Sade Sati', 'Saturn transit period around natal Moon (साढ़ेसाती).'),
        ('Yoga', 'Planetary combination indicating patterns (योग).'),
    ]
