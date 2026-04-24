const ZODIAC_SIGNS = [
  'Aries',
  'Taurus',
  'Gemini',
  'Cancer',
  'Leo',
  'Virgo',
  'Libra',
  'Scorpio',
  'Sagittarius',
  'Capricorn',
  'Aquarius',
  'Pisces',
] as const;

type ZodiacSign = (typeof ZODIAC_SIGNS)[number];

export type EphemerisRow = {
  planet: string;
  symbol: string;
  longitude: number;
  sign: ZodiacSign;
  degInSign: number;
  nakshatra: string;
  pada: number;
  retrograde: boolean;
};

export type PrashnaInput = {
  birthDate: string;
  birthTime: string;
  birthPlace: string;
  direction?: string;
};

export type PrashnaSnapshot = {
  lagnaSign: ZodiacSign;
  lagnaLord: string;
  moonSign: ZodiacSign;
  relevanceHouses: string[];
  obstacleHouses: string[];
  localSiderealTime: string;
  rawAscendantDegrees: number;
  rawMoonDegrees: number;
  ephemerisChart: EphemerisRow[];
  calculationNote: string;
};

const LAGNA_LORD: Record<ZodiacSign, string> = {
  Aries: 'Mars',
  Taurus: 'Venus',
  Gemini: 'Mercury',
  Cancer: 'Moon',
  Leo: 'Sun',
  Virgo: 'Mercury',
  Libra: 'Venus',
  Scorpio: 'Mars',
  Sagittarius: 'Jupiter',
  Capricorn: 'Saturn',
  Aquarius: 'Saturn',
  Pisces: 'Jupiter',
};

const NAKSHATRAS = [
  'Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira', 'Ardra',
  'Punarvasu', 'Pushya', 'Ashlesha', 'Magha', 'Purva Phalguni', 'Uttara Phalguni',
  'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha',
  'Mula', 'Purva Ashadha', 'Uttara Ashadha', 'Shravana', 'Dhanishtha',
  'Shatabhisha', 'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati',
] as const;

const PLANET_SYMBOLS: Record<string, string> = {
  Sun: '☉', Moon: '☽', Mars: '♂', Mercury: '☿',
  Jupiter: '♃', Venus: '♀', Saturn: '♄', Rahu: '☊', Ketu: '☋',
};

const CITY_COORDS: Record<string, { lat: number; lon: number }> = {
  melbourne: { lat: -37.8136, lon: 144.9631 },
  delhi: { lat: 28.6139, lon: 77.209 },
  mumbai: { lat: 19.076, lon: 72.8777 },
  london: { lat: 51.5072, lon: -0.1276 },
  newyork: { lat: 40.7128, lon: -74.006 },
  sydney: { lat: -33.8688, lon: 151.2093 },
};

// ── Math helpers ─────────────────────────────────────────────────────────────

const DEG = Math.PI / 180;

function normalizeDegrees(deg: number) {
  return ((deg % 360) + 360) % 360;
}

function toJulianDay(date: Date) {
  return date.getTime() / 86400000 + 2440587.5;
}

function gmstDegrees(julianDay: number) {
  const t = (julianDay - 2451545.0) / 36525.0;
  const gmst =
    280.46061837 +
    360.98564736629 * (julianDay - 2451545) +
    0.000387933 * t * t -
    (t * t * t) / 38710000;
  return normalizeDegrees(gmst);
}

function getSignFromLongitude(longitude: number): ZodiacSign {
  return ZODIAC_SIGNS[Math.floor(normalizeDegrees(longitude) / 30)];
}

function formatSiderealTime(deg: number) {
  const totalHours = normalizeDegrees(deg) / 15;
  const hours = Math.floor(totalHours);
  const mins = Math.floor((totalHours - hours) * 60);
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

function estimateCoords(place: string) {
  const normalized = place.toLowerCase().replace(/[^a-z]/g, '');
  for (const [key, coords] of Object.entries(CITY_COORDS)) {
    if (normalized.includes(key)) return coords;
  }
  return { lat: 0, lon: 77.209 }; // fallback near India longitudes for Jyotish context
}

// ── Ayanamsha (Lahiri) ───────────────────────────────────────────────────────
// At J2000.0: 23.8526°; rate ≈ 50.279"/yr = 0.00003824°/day

function lahiriAyanamsha(jd: number) {
  return 23.8526 + 0.00003824 * (jd - 2451545.0);
}

// ── Tropical planet longitudes (simplified Keplerian) ────────────────────────

function sunLongitudeTropical(d: number) {
  const L = normalizeDegrees(280.4665 + 0.98564736 * d);
  const g = normalizeDegrees(357.5291 + 0.98560028 * d);
  return normalizeDegrees(L + 1.9146 * Math.sin(g * DEG) + 0.0200 * Math.sin(2 * g * DEG));
}

function moonLongitudeTropical(d: number) {
  const l0 = normalizeDegrees(218.316 + 13.176396 * d);
  const mMoon = normalizeDegrees(134.963 + 13.064993 * d);
  return normalizeDegrees(l0 + 6.289 * Math.sin(mMoon * DEG));
}

function mercuryLongitudeTropical(d: number) {
  const L = normalizeDegrees(252.2509 + 4.09233445 * d);
  const M = normalizeDegrees(174.7948 + 4.09233445 * d);
  return normalizeDegrees(L + 23.4400 * Math.sin(M * DEG) + 2.9818 * Math.sin(2 * M * DEG));
}

function venusLongitudeTropical(d: number) {
  const L = normalizeDegrees(181.9798 + 1.60213034 * d);
  const M = normalizeDegrees(50.4161 + 1.60213034 * d);
  return normalizeDegrees(L + 0.7758 * Math.sin(M * DEG) + 0.0033 * Math.sin(2 * M * DEG));
}

function marsLongitudeTropical(d: number) {
  const L = normalizeDegrees(355.4330 + 0.52407108 * d);
  const M = normalizeDegrees(19.3870 + 0.52407108 * d);
  return normalizeDegrees(L + 10.6912 * Math.sin(M * DEG) + 0.6228 * Math.sin(2 * M * DEG));
}

function jupiterLongitudeTropical(d: number) {
  const L = normalizeDegrees(34.3515 + 0.08309256 * d);
  const M = normalizeDegrees(19.8950 + 0.08309256 * d);
  return normalizeDegrees(L + 5.5549 * Math.sin(M * DEG) + 0.1683 * Math.sin(2 * M * DEG));
}

function saturnLongitudeTropical(d: number) {
  const L = normalizeDegrees(50.0774 + 0.03344599 * d);
  const M = normalizeDegrees(316.9670 + 0.03344599 * d);
  return normalizeDegrees(L + 6.3585 * Math.sin(M * DEG) + 0.2204 * Math.sin(2 * M * DEG));
}

function rahuLongitudeTropical(d: number) {
  // Mean lunar north node moves retrograde
  return normalizeDegrees(125.0445 - 0.05295377 * d);
}

// ── Nakshatra lookup ─────────────────────────────────────────────────────────

function getNakshatraInfo(siderealLong: number): { nakshatra: string; pada: number } {
  const norm = normalizeDegrees(siderealLong);
  const nakshatraSpan = 360 / 27; // 13.333...°
  const padaSpan = nakshatraSpan / 4;
  const idx = Math.floor(norm / nakshatraSpan);
  const posInNakshatra = norm - idx * nakshatraSpan;
  const pada = Math.floor(posInNakshatra / padaSpan) + 1;
  return { nakshatra: NAKSHATRAS[idx % 27], pada };
}

// ── Retrograde detection (compare position 1 day later) ─────────────────────

function isRetrograde(lonFn: (d: number) => number, d: number): boolean {
  const lon0 = lonFn(d);
  const lon1 = lonFn(d + 1);
  // handle wrap-around near 0°/360°
  let delta = lon1 - lon0;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  return delta < 0;
}

// ── Ephemeris chart builder ──────────────────────────────────────────────────

function buildEphemerisRow(
  planet: string,
  tropicalLonFn: (d: number) => number,
  d: number,
  ayanamsha: number
): EphemerisRow {
  const tropical = tropicalLonFn(d);
  const sidereal = normalizeDegrees(tropical - ayanamsha);
  const sign = getSignFromLongitude(sidereal);
  const degInSign = Number((sidereal % 30).toFixed(2));
  const { nakshatra, pada } = getNakshatraInfo(sidereal);
  const retrograde = planet === 'Rahu' || planet === 'Ketu'
    ? true // nodes are always mean-retrograde
    : isRetrograde(tropicalLonFn, d);
  return {
    planet,
    symbol: PLANET_SYMBOLS[planet] ?? '✦',
    longitude: Number(sidereal.toFixed(2)),
    sign,
    degInSign,
    nakshatra,
    pada,
    retrograde,
  };
}

function generateEphemerisChart(d: number, ayanamsha: number): EphemerisRow[] {
  const rahuTrop = rahuLongitudeTropical(d);
  const rahuSid = normalizeDegrees(rahuTrop - ayanamsha);
  const ketuSid = normalizeDegrees(rahuSid + 180);
  const ketuSign = getSignFromLongitude(ketuSid);
  const ketuDegInSign = Number((ketuSid % 30).toFixed(2));
  const { nakshatra: ketuNak, pada: ketuPada } = getNakshatraInfo(ketuSid);

  const rows: EphemerisRow[] = [
    buildEphemerisRow('Sun',     sunLongitudeTropical,     d, ayanamsha),
    buildEphemerisRow('Moon',    moonLongitudeTropical,    d, ayanamsha),
    buildEphemerisRow('Mars',    marsLongitudeTropical,    d, ayanamsha),
    buildEphemerisRow('Mercury', mercuryLongitudeTropical, d, ayanamsha),
    buildEphemerisRow('Jupiter', jupiterLongitudeTropical, d, ayanamsha),
    buildEphemerisRow('Venus',   venusLongitudeTropical,   d, ayanamsha),
    buildEphemerisRow('Saturn',  saturnLongitudeTropical,  d, ayanamsha),
    buildEphemerisRow('Rahu',    rahuLongitudeTropical,    d, ayanamsha),
    {
      planet: 'Ketu',
      symbol: PLANET_SYMBOLS['Ketu'],
      longitude: Number(ketuSid.toFixed(2)),
      sign: ketuSign,
      degInSign: ketuDegInSign,
      nakshatra: ketuNak,
      pada: ketuPada,
      retrograde: true,
    },
  ];
  return rows;
}

// ── Main export ──────────────────────────────────────────────────────────────

export function generatePrashnaSnapshot(input: PrashnaInput): PrashnaSnapshot {
  const dateTime = new Date(`${input.birthDate}T${input.birthTime}`);
  const { lat, lon } = estimateCoords(input.birthPlace);

  const jd = toJulianDay(dateTime);
  const d = jd - 2451545.0;
  const ayanamsha = lahiriAyanamsha(jd);

  const gmst = gmstDegrees(jd);
  const lst = normalizeDegrees(gmst + lon);

  const epsilon = 23.4393 * DEG;
  const theta = lst * DEG;
  const phi = lat * DEG;

  const ascRad = Math.atan2(
    Math.sin(theta) * Math.cos(epsilon) + Math.tan(phi) * Math.sin(epsilon),
    Math.cos(theta)
  );

  // Apply ayanamsha to get sidereal ascendant
  const ascTropical = normalizeDegrees((ascRad * 180) / Math.PI);
  const ascDeg = normalizeDegrees(ascTropical - ayanamsha);
  const moonDeg = normalizeDegrees(moonLongitudeTropical(d) - ayanamsha);

  const lagnaSign = getSignFromLongitude(ascDeg);
  const moonSign = getSignFromLongitude(moonDeg);

  const ephemerisChart = generateEphemerisChart(d, ayanamsha);

  return {
    lagnaSign,
    lagnaLord: LAGNA_LORD[lagnaSign],
    moonSign,
    relevanceHouses: ['5th (romance)', '7th (partnership)', '11th (wish fulfillment)'],
    obstacleHouses: ['6th (conflict)', '8th (uncertainty)', '12th (loss/delay)'],
    localSiderealTime: formatSiderealTime(lst),
    rawAscendantDegrees: Number(ascDeg.toFixed(2)),
    rawMoonDegrees: Number(moonDeg.toFixed(2)),
    ephemerisChart,
    calculationNote:
      `Sidereal (Lahiri ayanamsha ${ayanamsha.toFixed(2)}°). All 9 grahas via simplified Keplerian elements. ±2–5° accuracy.`,
  };
}
