from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo

import requests
from timezonefinder import TimezoneFinder


def suggest_locations(query: str, limit: int = 5) -> list[dict[str, str | float]]:
    q = (query or '').strip()
    if not q:
        return []

    res = requests.get(
        'https://nominatim.openstreetmap.org/search',
        params={'q': q, 'format': 'json', 'addressdetails': 1, 'limit': limit},
        headers={'User-Agent': 'VedicJyotish/1.0'},
        timeout=12,
    )
    res.raise_for_status()

    out: list[dict[str, str | float]] = []
    for item in res.json():
        lat = float(item['lat'])
        lon = float(item['lon'])
        out.append(
            {
                'label': item.get('display_name', q),
                'lat': lat,
                'lon': lon,
                'timezone': timezone_for_coords(lat, lon),
            }
        )
    return out


def timezone_for_coords(lat: float, lon: float) -> str:
    tz = TimezoneFinder().timezone_at(lat=lat, lng=lon)
    return tz or 'UTC'


def local_to_utc(dt_local_naive: datetime, tz_name: str) -> datetime:
    return dt_local_naive.replace(tzinfo=ZoneInfo(tz_name)).astimezone(ZoneInfo('UTC'))
