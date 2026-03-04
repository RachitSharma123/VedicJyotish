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

const CITY_COORDS: Record<string, { lat: number; lon: number }> = {
  melbourne: { lat: -37.8136, lon: 144.9631 },
  delhi: { lat: 28.6139, lon: 77.209 },
  mumbai: { lat: 19.076, lon: 72.8777 },
  london: { lat: 51.5072, lon: -0.1276 },
  newyork: { lat: 40.7128, lon: -74.006 },
  sydney: { lat: -33.8688, lon: 151.2093 },
};

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

function moonLongitudeApprox(jd: number) {
  const d = jd - 2451545.0;
  const l0 = normalizeDegrees(218.316 + 13.176396 * d);
  const mMoon = normalizeDegrees(134.963 + 13.064993 * d);
  const lon = l0 + 6.289 * Math.sin((mMoon * Math.PI) / 180);
  return normalizeDegrees(lon);
}

export function generatePrashnaSnapshot(input: PrashnaInput): PrashnaSnapshot {
  const dateTime = new Date(`${input.birthDate}T${input.birthTime}`);
  const { lat, lon } = estimateCoords(input.birthPlace);

  const jd = toJulianDay(dateTime);
  const gmst = gmstDegrees(jd);
  const lst = normalizeDegrees(gmst + lon);

  const epsilon = 23.4393 * (Math.PI / 180);
  const theta = lst * (Math.PI / 180);
  const phi = lat * (Math.PI / 180);

  const ascRad = Math.atan2(
    Math.sin(theta) * Math.cos(epsilon) + Math.tan(phi) * Math.sin(epsilon),
    Math.cos(theta)
  );

  const ascDeg = normalizeDegrees((ascRad * 180) / Math.PI);
  const moonDeg = moonLongitudeApprox(jd);
  const lagnaSign = getSignFromLongitude(ascDeg);
  const moonSign = getSignFromLongitude(moonDeg);

  return {
    lagnaSign,
    lagnaLord: LAGNA_LORD[lagnaSign],
    moonSign,
    relevanceHouses: ['5th (romance)', '7th (partnership)', '11th (wish fulfillment)'],
    obstacleHouses: ['6th (conflict)', '8th (uncertainty)', '12th (loss/delay)'],
    localSiderealTime: formatSiderealTime(lst),
    rawAscendantDegrees: Number(ascDeg.toFixed(2)),
    rawMoonDegrees: Number(moonDeg.toFixed(2)),
    calculationNote:
      'Main calculations: timestamp normalization, sidereal-time estimate, ascendant approximation, moon longitude approximation, and prashna house significance mapping.',
  };
}
