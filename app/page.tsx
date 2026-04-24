'use client';

import { FormEvent, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { AnimatePresence, motion } from 'framer-motion';
import { ApiError, fetchJson } from './lib/fetch-json';
import { Calendar, Clock, Compass, MapPin, MessageCircle, User } from 'lucide-react';

type EphemerisRow = {
  planet: string;
  symbol: string;
  longitude: number;
  sign: string;
  degInSign: number;
  nakshatra: string;
  pada: number;
  retrograde: boolean;
};

type PrashnaSnapshot = {
  lagnaSign: string;
  lagnaLord: string;
  moonSign: string;
  relevanceHouses: string[];
  obstacleHouses: string[];
  localSiderealTime: string;
  rawAscendantDegrees: number;
  rawMoonDegrees: number;
  ephemerisChart: EphemerisRow[];
  calculationNote: string;
};

type BirthChartResponse = { ok: true; interpretation: string; prashna: PrashnaSnapshot };

const ZODIAC_SYMBOLS: Record<string, string> = {
  Aries: '♈', Taurus: '♉', Gemini: '♊', Cancer: '♋',
  Leo: '♌', Virgo: '♍', Libra: '♎', Scorpio: '♏',
  Sagittarius: '♐', Capricorn: '♑', Aquarius: '♒', Pisces: '♓',
};

const PLANET_SYMBOLS: Record<string, string> = {
  Sun: '☉', Moon: '☽', Mars: '♂', Mercury: '☿',
  Jupiter: '♃', Venus: '♀', Saturn: '♄',
  Rahu: '☊', Ketu: '☋', Unknown: '✦',
};

function SpaceBackground() {
  return (
    <video
      className="star-field"
      autoPlay
      muted
      loop
      playsInline
      aria-hidden="true"
      poster="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=="
    >
      <source src="https://videos.pexels.com/video-files/36735105/15568067_1920_1080_30fps.mp4" type="video/mp4" />
      <source src="https://videos.pexels.com/video-files/34248009/14512643_1920_1080_24fps.mp4" type="video/mp4" />
    </video>
  );
}

export default function Page() {
  const [isDark, setIsDark] = useState(true);
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [birthTime, setBirthTime] = useState(() => new Date().toTimeString().slice(0, 5));
  const [birthPlace, setBirthPlace] = useState('');
  const [direction, setDirection] = useState('North');
  const [question, setQuestion] = useState('');

  const model = 'mistralai/mistral-large-3-675b-instruct-2512';

  const [result, setResult] = useState('');
  const [prashna, setPrashna] = useState<PrashnaSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const stored = window.localStorage.getItem('theme');
    const initialDark = stored ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    setIsDark(initialDark);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    window.localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  const [showErrors, setShowErrors] = useState(false);

  const canSubmit = useMemo(
    () => !!birthDate && !!birthTime && !!birthPlace && !!question.trim(),
    [birthDate, birthTime, birthPlace, question]
  );

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) { setShowErrors(true); return; }
    setShowErrors(false);
    setLoading(true);
    setError('');
    try {
      const data = await fetchJson<BirthChartResponse>(
        '/api/birth-chart',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            birthDate,
            birthTime,
            birthPlace,
            direction,
            question,
            provider: 'nvidia',
            model,
          }),
        },
        { retries: 0, timeoutMs: 55000 }
      );
      setResult(data.interpretation);
      setPrashna(data.prashna);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? `${err.message}${err.requestId ? ` (id: ${err.requestId})` : ''}`
          : 'The cosmos are silent. Please retry in a moment.'
      );
    } finally {
      setLoading(false);
    }
  }

  const lagnaSymbol = prashna ? (ZODIAC_SYMBOLS[prashna.lagnaSign] ?? '✦') : '';
  const moonSymbol  = prashna ? (ZODIAC_SYMBOLS[prashna.moonSign]  ?? '✦') : '';
  const lordSymbol  = prashna ? (PLANET_SYMBOLS[prashna.lagnaLord] ?? '✦') : '';

  const spring = { type: 'spring' as const, damping: 20, stiffness: 90 };
  const easing = [0.16, 1, 0.3, 1] as const;
  const fadeUp = {
    hidden: { opacity: 0, y: 20 },
    show:   { opacity: 1, y: 0, transition: { duration: 0.5, ease: easing } },
  };
  const stagger = { show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } } };

  return (
    <>
      <SpaceBackground />

      {/* ── Ambient Blobs ── */}
      <div className="ambient-blobs" aria-hidden="true">
        <motion.div
          className="blob blob-1"
          animate={{ x: [0, 40, -20, 0], y: [0, -30, 20, 0] }}
          transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="blob blob-2"
          animate={{ x: [0, -35, 25, 0], y: [0, 25, -20, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut', delay: 4 }}
        />
        <motion.div
          className="blob blob-3"
          animate={{ x: [0, 20, -30, 0], y: [0, -20, 15, 0] }}
          transition={{ duration: 26, repeat: Infinity, ease: 'easeInOut', delay: 8 }}
        />
      </div>

      <main>
        {/* ── Compact Header ───────────────────────── */}
        <motion.header
          className="header-bar"
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: easing }}
        >
          <div className="header-brand">
            <span className="header-om">ॐ</span>
            <div>
              <h1 className="header-title">VedicJyotish</h1>
              <p className="header-sub">Prashna Kundali Oracle · AI-Powered</p>
            </div>
          </div>
          <div className="header-symbols" aria-hidden="true">♈ ♉ ♊ ♋ ♌ ♍ ♎ ♏ ♐ ♑ ♒ ♓</div>
          <motion.button
            className="theme-switch"
            type="button"
            onClick={() => setIsDark((v) => !v)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.96 }}
            transition={spring}
          >
            {isDark ? '☀' : '☽'}
          </motion.button>
        </motion.header>

        {/* ── Main Grid ────────────────────────────── */}
        <div className="layout-grid">

          {/* ── Form ─────────────────────────────── */}
          <div className="panel-scroll">
          <motion.form
            className="card card-strong form-stack"
            onSubmit={onSubmit}
            variants={stagger}
            initial="hidden"
            animate="show"
          >
            <motion.div className="form-divider" variants={fadeUp}>✦ Prashna Query ✦</motion.div>

            <motion.label variants={fadeUp}>
              <span className="label-icon">
                <User size={13} /> Seeker&apos;s Name
                <span style={{ opacity: 0.5, textTransform: 'none', fontWeight: 400 }}>(optional)</span>
              </span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoComplete="name" />
            </motion.label>

            <motion.div className="row" variants={fadeUp}>
              <label style={{ flex: 1 }}>
                <span className="label-icon"><Calendar size={13} /> Date of Query</span>
                <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className={showErrors && !birthDate ? 'field-error' : ''} />
              </label>
              <label style={{ flex: 1 }}>
                <span className="label-icon"><Clock size={13} /> Time</span>
                <input type="time" value={birthTime} onChange={(e) => setBirthTime(e.target.value)} className={showErrors && !birthTime ? 'field-error' : ''} />
              </label>
            </motion.div>

            <motion.label variants={fadeUp}>
              <span className="label-icon">
                <MapPin size={13} /> Place of Query
                {showErrors && !birthPlace && <span className="field-hint">Required</span>}
              </span>
              <input
                value={birthPlace}
                onChange={(e) => setBirthPlace(e.target.value)}
                placeholder="City, Country"
                autoComplete="off"
                className={showErrors && !birthPlace ? 'field-error' : ''}
              />
            </motion.label>

            <motion.label variants={fadeUp}>
              <span className="label-icon"><Compass size={13} /> Direction Faced</span>
              <select value={direction} onChange={(e) => setDirection(e.target.value)}>
                {['North', 'East', 'South', 'West', 'North-East', 'North-West', 'South-East', 'South-West'].map(
                  (d) => <option key={d}>{d}</option>
                )}
              </select>
            </motion.label>

            <motion.label variants={fadeUp}>
              <span className="label-icon">
                <MessageCircle size={13} /> Prashna — Speak Your Question
                {showErrors && !question.trim() && <span className="field-hint">Required</span>}
              </span>
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Speak your query to the cosmos… e.g. Will this path lead to prosperity?"
                rows={3}
                className={showErrors && !question.trim() ? 'field-error' : ''}
              />
            </motion.label>

            <motion.button
              className="btn"
              type="submit"
              disabled={loading}
              variants={fadeUp}
              whileHover={canSubmit && !loading ? { scale: 1.02, y: -2 } : {}}
              whileTap={canSubmit && !loading ? { scale: 0.97 } : {}}
              transition={spring}
            >
              {loading ? (
                <><span className="spin">✦</span>Reading the cosmos…</>
              ) : (
                '✦ Reveal the Prashna Chart'
              )}
            </motion.button>

            <AnimatePresence>
              {error && (
                <motion.p
                  className="error"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>
          </motion.form>
          </div>

          {/* ── Right Column ─────────────────────── */}
          <div className="panel-scroll">

            <AnimatePresence mode="wait">
              {loading ? (
                <motion.section
                  key="loading"
                  className="card card-strong"
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.35, ease: easing }}
                >
                  <div className="cosmic-loader">
                    <div className="loader-mandala">
                      <div className="loader-ring loader-ring-1" />
                      <div className="loader-ring loader-ring-2" />
                      <div className="loader-ring loader-ring-3" />
                      <motion.span
                        style={{ fontSize: '1.2rem', color: 'var(--gold)', zIndex: 1 }}
                        animate={{ scale: [1, 1.15, 1] }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                      >
                        ॐ
                      </motion.span>
                    </div>
                    <p className="loader-text">Consulting the celestial realm</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%', maxWidth: '280px' }}>
                      {[85, 65, 75].map((w, i) => (
                        <div key={i} className="skeleton-block" style={{ height: '12px', width: `${w}%`, animationDelay: `${i * 0.15}s` }} />
                      ))}
                    </div>
                    <p className="loader-sub">The grahas are aligning your answer…</p>
                  </div>
                </motion.section>
              ) : result ? (
                <motion.section
                  key="result"
                  className="card card-strong"
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                >
                  <p className="result-panel-title">✦ Your Prashna Reading ✦</p>
                  <div className="result-markdown">
                    <ReactMarkdown>{result}</ReactMarkdown>
                  </div>
                </motion.section>
              ) : (
                <motion.section
                  key="placeholder"
                  className="card card-strong"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <div className="result-placeholder">
                    <div className="placeholder-symbol">🔮</div>
                    <p className="placeholder-text">The cosmos await your query</p>
                    <p className="placeholder-sub">Enter the moment of your question and let the stars speak</p>
                  </div>
                </motion.section>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {prashna && (
                <>
                  <motion.section
                    className="card"
                    key="snapshot"
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.1 }}
                  >
                    <p className="snapshot-title">✦ Celestial Snapshot ✦</p>
                    <motion.div
                      className="stat-grid"
                      variants={stagger}
                      initial="hidden"
                      animate="show"
                    >
                      {[
                        { key: 'Lagna', val: <><span className="zodiac-sym">{lagnaSymbol}</span>{prashna.lagnaSign}</> },
                        { key: 'Lagna Lord', val: <><span className="zodiac-sym">{lordSymbol}</span>{prashna.lagnaLord}</> },
                        { key: 'Moon Sign', val: <><span className="zodiac-sym">{moonSymbol}</span>{prashna.moonSign}</> },
                        { key: 'Sidereal Time', val: prashna.localSiderealTime },
                        { key: 'Ascendant', val: `${prashna.rawAscendantDegrees}°` },
                        { key: 'Moon Longitude', val: `${prashna.rawMoonDegrees}°` },
                      ].map(({ key, val }) => (
                        <motion.div key={key} className="stat" variants={fadeUp}>
                          <div className="stat-key">{key}</div>
                          <div className="stat-val">{val}</div>
                        </motion.div>
                      ))}

                      <motion.div className="stat" style={{ gridColumn: '1 / -1' }} variants={fadeUp}>
                        <div className="stat-key">Relevant Houses</div>
                        <div className="stat-val" style={{ flexWrap: 'wrap' }}>
                          {prashna.relevanceHouses.map((h) => <span key={h} className="house-tag">{h}</span>)}
                        </div>
                      </motion.div>

                      <motion.div className="stat" style={{ gridColumn: '1 / -1' }} variants={fadeUp}>
                        <div className="stat-key">Obstacle Houses</div>
                        <div className="stat-val" style={{ flexWrap: 'wrap' }}>
                          {prashna.obstacleHouses.map((h) => <span key={h} className="house-tag obstacle">{h}</span>)}
                        </div>
                      </motion.div>

                      <motion.div className="stat" style={{ gridColumn: '1 / -1' }} variants={fadeUp}>
                        <div className="stat-key">Calculation Note</div>
                        <div className="stat-val" style={{ fontSize: '0.82rem', fontWeight: 400, opacity: 0.75 }}>
                          {prashna.calculationNote}
                        </div>
                      </motion.div>
                    </motion.div>
                  </motion.section>

                  {prashna.ephemerisChart?.length > 0 && (
                    <motion.section
                      className="card"
                      key="ephemeris"
                      initial={{ opacity: 0, y: 24 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: 0.2 }}
                    >
                      <p className="snapshot-title">✦ Ephemeris Chart — Navagrahas ✦</p>
                      <div style={{ overflowX: 'auto' }}>
                        <table className="ephemeris-table">
                          <thead>
                            <tr>
                              {['Graha', 'Sign', 'Deg', 'Nakshatra', 'Pada', 'R?'].map((h) => (
                                <th key={h}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {prashna.ephemerisChart.map((row, i) => (
                              <motion.tr
                                key={row.planet}
                                initial={{ opacity: 0, x: -12 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.045, duration: 0.35, ease: easing }}
                              >
                                <td style={{ fontWeight: 600 }}>
                                  <span style={{ marginRight: '6px', fontSize: '1.05rem' }}>{row.symbol}</span>
                                  {row.planet}
                                </td>
                                <td>{row.sign}</td>
                                <td style={{ fontVariantNumeric: 'tabular-nums' }}>{row.degInSign.toFixed(2)}°</td>
                                <td>{row.nakshatra}</td>
                                <td style={{ textAlign: 'center' }}>{row.pada}</td>
                                <td style={{ textAlign: 'center' }} className={row.retrograde ? 'retrograde-mark' : ''}>
                                  {row.retrograde ? '℞' : '—'}
                                </td>
                              </motion.tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </motion.section>
                  )}
                </>
              )}
            </AnimatePresence>

          </div>

        </div>
      </main>
    </>
  );
}
