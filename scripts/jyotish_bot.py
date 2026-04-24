"""
VedicJyotish Prashna Kundali — Telegram Bot
Conversation flow: name → date → time → place → direction → question → reading
"""

import asyncio
import json
import logging
import math
import os
import re
from datetime import datetime, timezone
from pathlib import Path

import httpx
from telegram import Update, ReplyKeyboardMarkup, ReplyKeyboardRemove
from telegram.ext import (
    Application,
    ApplicationBuilder,
    CommandHandler,
    ContextTypes,
    ConversationHandler,
    MessageHandler,
    filters,
)

# ── Config ────────────────────────────────────────────────────────────────────

BOT_TOKEN    = os.environ.get("JYOTISH_BOT_TOKEN", "YOUR_BOT_TOKEN_HERE")
OPENROUTER_KEY = os.environ.get("OPENROUTER_API_KEY", "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")
LLM_MODEL    = "deepseek/deepseek-chat"
LLM_URL      = "https://openrouter.ai/api/v1/chat/completions"

logging.basicConfig(format="%(asctime)s %(levelname)s %(message)s", level=logging.INFO)
log = logging.getLogger(__name__)

# ── Conversation states ───────────────────────────────────────────────────────

NAME, DATE, TIME, PLACE, DIRECTION, QUESTION = range(6)

DIRECTIONS = ["North", "East", "South", "West", "North-East", "North-West", "South-East", "South-West"]

# ── Astrology core (ported from astrology.ts) ─────────────────────────────────

ZODIAC_SIGNS = [
    "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
    "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
]

NAKSHATRAS = [
    "Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira", "Ardra",
    "Punarvasu", "Pushya", "Ashlesha", "Magha", "Purva Phalguni", "Uttara Phalguni",
    "Hasta", "Chitra", "Swati", "Vishakha", "Anuradha", "Jyeshtha",
    "Mula", "Purva Ashadha", "Uttara Ashadha", "Shravana", "Dhanishtha",
    "Shatabhisha", "Purva Bhadrapada", "Uttara Bhadrapada", "Revati",
]

LAGNA_LORD = {
    "Aries": "Mars", "Taurus": "Venus", "Gemini": "Mercury", "Cancer": "Moon",
    "Leo": "Sun", "Virgo": "Mercury", "Libra": "Venus", "Scorpio": "Mars",
    "Sagittarius": "Jupiter", "Capricorn": "Saturn", "Aquarius": "Saturn", "Pisces": "Jupiter",
}

PLANET_SYMBOLS = {
    "Sun": "☉", "Moon": "☽", "Mars": "♂", "Mercury": "☿",
    "Jupiter": "♃", "Venus": "♀", "Saturn": "♄", "Rahu": "☊", "Ketu": "☋",
}

CITY_COORDS = {
    "melbourne": (-37.8136, 144.9631),
    "delhi": (28.6139, 77.209),
    "mumbai": (19.076, 72.8777),
    "london": (51.5072, -0.1276),
    "newyork": (40.7128, -74.006),
    "sydney": (-33.8688, 151.2093),
    "brisbane": (-27.4698, 153.0251),
    "perth": (-31.9505, 115.8605),
    "bangalore": (12.9716, 77.5946),
    "hyderabad": (17.3850, 78.4867),
    "chennai": (13.0827, 80.2707),
    "kolkata": (22.5726, 88.3639),
    "pune": (18.5204, 73.8567),
    "ahmedabad": (23.0225, 72.5714),
    "jaipur": (26.9124, 75.7873),
}

DEG = math.pi / 180


def norm(deg: float) -> float:
    return ((deg % 360) + 360) % 360


def to_julian(dt: datetime) -> float:
    return dt.timestamp() / 86400 + 2440587.5


def estimate_coords(place: str) -> tuple[float, float]:
    key = re.sub(r"[^a-z]", "", place.lower())
    for city, coords in CITY_COORDS.items():
        if city in key:
            return coords
    return (0.0, 77.209)


def lahiri_ayanamsha(jd: float) -> float:
    return 23.8526 + 0.00003824 * (jd - 2451545.0)


def gmst_degrees(jd: float) -> float:
    t = (jd - 2451545.0) / 36525.0
    gmst = (280.46061837
            + 360.98564736629 * (jd - 2451545.0)
            + 0.000387933 * t * t
            - (t ** 3) / 38710000)
    return norm(gmst)


def get_sign(lon: float) -> str:
    return ZODIAC_SIGNS[int(norm(lon) / 30)]


def get_nakshatra(sid: float) -> tuple[str, int]:
    n = norm(sid)
    span = 360 / 27
    idx = int(n / span)
    pada = int((n - idx * span) / (span / 4)) + 1
    return NAKSHATRAS[idx % 27], min(pada, 4)


# Planet tropical longitude functions (d = JD - 2451545)

def sun_lon(d):    return norm(280.4665 + 0.98564736*d + 1.9146*math.sin(norm(357.5291 + 0.98560028*d)*DEG) + 0.0200*math.sin(2*norm(357.5291 + 0.98560028*d)*DEG))
def moon_lon(d):   return norm(218.316 + 13.176396*d + 6.289*math.sin(norm(134.963 + 13.064993*d)*DEG))
def merc_lon(d):   M=norm(174.7948+4.09233445*d); return norm(252.2509+4.09233445*d + 23.44*math.sin(M*DEG) + 2.9818*math.sin(2*M*DEG))
def venus_lon(d):  M=norm(50.4161+1.60213034*d);  return norm(181.9798+1.60213034*d + 0.7758*math.sin(M*DEG) + 0.0033*math.sin(2*M*DEG))
def mars_lon(d):   M=norm(19.3870+0.52407108*d);  return norm(355.4330+0.52407108*d + 10.6912*math.sin(M*DEG) + 0.6228*math.sin(2*M*DEG))
def jup_lon(d):    M=norm(19.8950+0.08309256*d);  return norm(34.3515+0.08309256*d + 5.5549*math.sin(M*DEG) + 0.1683*math.sin(2*M*DEG))
def sat_lon(d):    M=norm(316.9670+0.03344599*d); return norm(50.0774+0.03344599*d + 6.3585*math.sin(M*DEG) + 0.2204*math.sin(2*M*DEG))
def rahu_lon(d):   return norm(125.0445 - 0.05295377*d)


def is_retro(fn, d: float) -> bool:
    delta = fn(d + 1) - fn(d)
    if delta > 180: delta -= 360
    if delta < -180: delta += 360
    return delta < 0


def compute_snapshot(date_str: str, time_str: str, place: str) -> dict:
    dt = datetime.fromisoformat(f"{date_str}T{time_str}").replace(tzinfo=timezone.utc)
    jd = to_julian(dt)
    d = jd - 2451545.0
    aya = lahiri_ayanamsha(jd)
    lat, lon = estimate_coords(place)

    gmst = gmst_degrees(jd)
    lst = norm(gmst + lon)

    epsilon = 23.4393 * DEG
    theta = lst * DEG
    phi = lat * DEG

    asc_rad = math.atan2(
        math.sin(theta) * math.cos(epsilon) + math.tan(phi) * math.sin(epsilon),
        math.cos(theta)
    )
    asc_tropical = norm(math.degrees(asc_rad))
    asc_sid = norm(asc_tropical - aya)
    moon_sid = norm(moon_lon(d) - aya)

    lagna_sign = get_sign(asc_sid)
    moon_sign = get_sign(moon_sid)

    planets = [
        ("Sun",     sun_lon,  False),
        ("Moon",    moon_lon, False),
        ("Mars",    mars_lon, False),
        ("Mercury", merc_lon, False),
        ("Jupiter", jup_lon,  False),
        ("Venus",   venus_lon,False),
        ("Saturn",  sat_lon,  False),
        ("Rahu",    rahu_lon, True),
    ]

    rows = []
    for name, fn, always_retro in planets:
        trop = fn(d)
        sid = norm(trop - aya)
        sign = get_sign(sid)
        deg_in_sign = round(sid % 30, 2)
        nak, pada = get_nakshatra(sid)
        retro = always_retro or is_retro(fn, d)
        rows.append({
            "planet": name, "symbol": PLANET_SYMBOLS[name],
            "sign": sign, "deg": deg_in_sign,
            "nakshatra": nak, "pada": pada, "retro": retro,
        })

    # Ketu = Rahu + 180
    rahu_sid = norm(rahu_lon(d) - aya)
    ketu_sid = norm(rahu_sid + 180)
    knak, kpada = get_nakshatra(ketu_sid)
    rows.append({
        "planet": "Ketu", "symbol": PLANET_SYMBOLS["Ketu"],
        "sign": get_sign(ketu_sid), "deg": round(ketu_sid % 30, 2),
        "nakshatra": knak, "pada": kpada, "retro": True,
    })

    hours = int(lst / 15)
    mins = int((lst / 15 - hours) * 60)
    lst_str = f"{hours:02d}:{mins:02d}"

    return {
        "lagna_sign": lagna_sign,
        "lagna_lord": LAGNA_LORD[lagna_sign],
        "moon_sign": moon_sign,
        "asc_deg": round(asc_sid, 2),
        "moon_deg": round(moon_sid, 2),
        "lst": lst_str,
        "ayanamsha": round(aya, 2),
        "ephemeris": rows,
    }


# ── LLM call ─────────────────────────────────────────────────────────────────

async def get_reading(snap: dict, name: str, date: str, time: str, place: str, direction: str, question: str) -> str:
    eph_lines = "\n".join(
        f"  {r['symbol']} {r['planet']:<8} {r['sign']:<13} {r['deg']:>6.2f}°  {r['nakshatra']:<18} pada {r['pada']}{'  (R)' if r['retro'] else ''}"
        for r in snap["ephemeris"]
    )
    prompt = f"""You are a Jyotish Prashna astrologer. Give a clear, structured reading.

Input:
- Name: {name or 'Unknown'}
- Date: {date}  Time: {time}  Place: {place}
- Direction faced: {direction}
- Question: {question}

Prashna snapshot (sidereal / Lahiri {snap['ayanamsha']}°):
- Lagna: {snap['lagna_sign']} (lord: {snap['lagna_lord']})
- Moon sign: {snap['moon_sign']}
- Ascendant: {snap['asc_deg']}°  Moon: {snap['moon_deg']}°
- LST: {snap['lst']}

Ephemeris Chart — all 9 grahas:
{eph_lines}

Rule flow:
1) Note Lagna + lord placement
2) Judge Moon for emotional truth
3) Analyse all 9 grahas — sign, nakshatra, retrograde
4) Houses 5/7/11 = support; 6/8/12 = obstacles
5) Significators verdict
6) Timing window
7) Remedies / practical advice

Keep it insightful and concise. Use markdown headings."""

    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            LLM_URL,
            headers={"Authorization": f"Bearer {OPENROUTER_KEY}", "Content-Type": "application/json"},
            json={
                "model": LLM_MODEL,
                "messages": [
                    {"role": "system", "content": "You are an expert Vedic astrology assistant."},
                    {"role": "user", "content": prompt},
                ],
                "temperature": 0.5,
            },
        )
        data = resp.json()
    return data["choices"][0]["message"]["content"]


# ── Conversation handlers ─────────────────────────────────────────────────────

async def cmd_prashna(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    context.user_data.clear()
    now = datetime.now(timezone.utc)
    context.user_data["date"] = now.strftime("%Y-%m-%d")
    context.user_data["time"] = now.strftime("%H:%M")
    await update.message.reply_text(
        "🔮 *Prashna Kundali Oracle*\n\nSpeak your name (or send — to skip):",
        parse_mode="Markdown",
        reply_markup=ReplyKeyboardMarkup([["—"]], one_time_keyboard=True, resize_keyboard=True),
    )
    return NAME


async def got_name(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    text = update.message.text.strip()
    context.user_data["name"] = "" if text in ("—", "-") else text
    await update.message.reply_text(
        f"📅 Date of query (YYYY-MM-DD)\nDefault: {context.user_data['date']}",
        reply_markup=ReplyKeyboardMarkup([[context.user_data["date"]]], one_time_keyboard=True, resize_keyboard=True),
    )
    return DATE


async def got_date(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    text = update.message.text.strip()
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", text):
        await update.message.reply_text("❌ Format must be YYYY-MM-DD. Try again:")
        return DATE
    context.user_data["date"] = text
    await update.message.reply_text(
        f"🕐 Time of query (HH:MM, 24h)\nDefault: {context.user_data['time']}",
        reply_markup=ReplyKeyboardMarkup([[context.user_data["time"]]], one_time_keyboard=True, resize_keyboard=True),
    )
    return TIME


async def got_time(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    text = update.message.text.strip()
    if not re.match(r"^\d{2}:\d{2}$", text):
        await update.message.reply_text("❌ Format must be HH:MM. Try again:")
        return TIME
    context.user_data["time"] = text
    await update.message.reply_text("📍 Place of query (City, Country):")
    return PLACE


async def got_place(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    context.user_data["place"] = update.message.text.strip()
    kbd = [[d] for d in DIRECTIONS]
    await update.message.reply_text(
        "🧭 Direction you are facing:",
        reply_markup=ReplyKeyboardMarkup(kbd, one_time_keyboard=True, resize_keyboard=True),
    )
    return DIRECTION


async def got_direction(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    context.user_data["direction"] = update.message.text.strip()
    await update.message.reply_text(
        "🌌 Speak your Prashna — what does the cosmos need to answer?",
        reply_markup=ReplyKeyboardRemove(),
    )
    return QUESTION


async def got_question(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    ud = context.user_data
    ud["question"] = update.message.text.strip()

    await update.message.reply_text("✦ Computing celestial positions…", reply_markup=ReplyKeyboardRemove())
    await update.message.chat.send_action("typing")

    try:
        snap = compute_snapshot(ud["date"], ud["time"], ud["place"])
    except Exception as e:
        await update.message.reply_text(f"❌ Calculation error: {e}")
        return ConversationHandler.END

    # Build ephemeris table message
    eph_lines = []
    for r in snap["ephemeris"]:
        retro = " ℞" if r["retro"] else "  "
        eph_lines.append(f"{r['symbol']} *{r['planet']:<8}* {r['sign']:<13} `{r['deg']:>5.1f}°` {r['nakshatra']} P{r['pada']}{retro}")

    snapshot_msg = (
        f"✦ *Celestial Snapshot* ✦\n"
        f"Lagna: *{snap['lagna_sign']}* (lord: {snap['lagna_lord']})\n"
        f"Moon: *{snap['moon_sign']}*  LST: {snap['lst']}\n"
        f"Asc: {snap['asc_deg']}°  Ayanamsha: {snap['ayanamsha']}° (Lahiri)\n\n"
        f"*Ephemeris Chart*\n" + "\n".join(eph_lines)
    )
    await update.message.reply_text(snapshot_msg, parse_mode="Markdown")
    await update.message.chat.send_action("typing")

    try:
        reading = await get_reading(snap, ud.get("name",""), ud["date"], ud["time"], ud["place"], ud["direction"], ud["question"])
    except Exception as e:
        await update.message.reply_text(f"❌ LLM error: {e}")
        return ConversationHandler.END

    # Split long messages (Telegram 4096 char limit)
    for i in range(0, len(reading), 4000):
        await update.message.reply_text(reading[i:i+4000], parse_mode="Markdown")

    await update.message.reply_text("🔮 Type /prashna to ask again.", reply_markup=ReplyKeyboardRemove())
    return ConversationHandler.END


async def cmd_cancel(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    await update.message.reply_text("Cancelled.", reply_markup=ReplyKeyboardRemove())
    return ConversationHandler.END


async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "🔮 *VedicJyotish — Prashna Kundali Oracle*\n\n"
        "Ask the cosmos your question.\n\n"
        "Commands:\n"
        "/prashna — Start a Prashna reading\n"
        "/cancel — Cancel current session",
        parse_mode="Markdown",
    )


# ── Entry point ───────────────────────────────────────────────────────────────

def main():
    app = ApplicationBuilder().token(BOT_TOKEN).build()

    conv = ConversationHandler(
        entry_points=[CommandHandler("prashna", cmd_prashna)],
        states={
            NAME:      [MessageHandler(filters.TEXT & ~filters.COMMAND, got_name)],
            DATE:      [MessageHandler(filters.TEXT & ~filters.COMMAND, got_date)],
            TIME:      [MessageHandler(filters.TEXT & ~filters.COMMAND, got_time)],
            PLACE:     [MessageHandler(filters.TEXT & ~filters.COMMAND, got_place)],
            DIRECTION: [MessageHandler(filters.TEXT & ~filters.COMMAND, got_direction)],
            QUESTION:  [MessageHandler(filters.TEXT & ~filters.COMMAND, got_question)],
        },
        fallbacks=[CommandHandler("cancel", cmd_cancel)],
    )

    app.add_handler(CommandHandler("start", cmd_start))
    app.add_handler(conv)
    log.info("🔮 VedicJyotish bot running…")
    app.run_polling()


if __name__ == "__main__":
    main()
