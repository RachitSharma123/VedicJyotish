'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
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
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Stars
    const stars = Array.from({ length: 380 }, () => ({
      x: Math.random(), y: Math.random(),
      r: 0.15 + Math.random() * 1.8,
      phase: Math.random() * Math.PI * 2,
      speed: 0.002 + Math.random() * 0.007,
      gold: Math.random() > 0.72,
      blue: Math.random() > 0.85,
    }));

    // Shooting stars
    type Shooter = { x: number; y: number; vx: number; vy: number; len: number; alpha: number; life: number; maxLife: number };
    const shooters: Shooter[] = [];
    let nextShooter = 0;

    // Nebula clouds (static positions, animated opacity)
    const nebulas = [
      { x: 0.15, y: 0.25, rx: 0.22, ry: 0.18, r: 80, g: 40, b: 160, a: 0.06 },
      { x: 0.80, y: 0.65, rx: 0.28, ry: 0.20, r: 160, g: 60, b: 220, a: 0.05 },
      { x: 0.50, y: 0.10, rx: 0.35, ry: 0.15, r: 220, g: 130, b: 30,  a: 0.04 },
      { x: 0.30, y: 0.80, rx: 0.20, ry: 0.22, r: 30,  g: 80,  b: 200, a: 0.04 },
      { x: 0.90, y: 0.20, rx: 0.18, ry: 0.14, r: 200, g: 80,  b: 40,  a: 0.04 },
    ];

    let animId: number;
    function draw() {
      const W = canvas!.width, H = canvas!.height;
      const now = performance.now() * 0.001;

      ctx!.clearRect(0, 0, W, H);

      // Nebula clouds
      nebulas.forEach((n) => {
        const pulse = 0.7 + 0.3 * Math.sin(now * 0.2 + n.x * 5);
        const grd = ctx!.createRadialGradient(n.x * W, n.y * H, 0, n.x * W, n.y * H, Math.max(n.rx * W, n.ry * H));
        grd.addColorStop(0, `rgba(${n.r},${n.g},${n.b},${(n.a * pulse).toFixed(3)})`);
        grd.addColorStop(1, 'rgba(0,0,0,0)');
        ctx!.beginPath();
        ctx!.ellipse(n.x * W, n.y * H, n.rx * W, n.ry * H, 0, 0, Math.PI * 2);
        ctx!.fillStyle = grd;
        ctx!.fill();
      });

      // Galaxy core glow center
      const cx = W * 0.5, cy = H * 0.42;
      const core = ctx!.createRadialGradient(cx, cy, 0, cx, cy, W * 0.18);
      const coreAlpha = (0.04 + 0.02 * Math.sin(now * 0.15)).toFixed(3);
      core.addColorStop(0, `rgba(240,180,41,${coreAlpha})`);
      core.addColorStop(1, 'rgba(0,0,0,0)');
      ctx!.fillStyle = core;
      ctx!.fillRect(0, 0, W, H);

      // Stars
      stars.forEach((s) => {
        const alpha = (Math.sin(s.phase + now * s.speed * 6) + 1) / 2;
        ctx!.beginPath();
        ctx!.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2);
        const a = (alpha * 0.9).toFixed(2);
        ctx!.fillStyle = s.gold
          ? `rgba(240,180,41,${a})`
          : s.blue
          ? `rgba(150,180,255,${a})`
          : `rgba(210,220,255,${(alpha * 0.7).toFixed(2)})`;
        ctx!.fill();
      });

      // Shooting stars
      if (now > nextShooter) {
        shooters.push({
          x: Math.random() * W * 0.8,
          y: Math.random() * H * 0.5,
          vx: 4 + Math.random() * 6,
          vy: 1 + Math.random() * 3,
          len: 80 + Math.random() * 120,
          alpha: 1,
          life: 0,
          maxLife: 0.6 + Math.random() * 0.4,
        });
        nextShooter = now + 3 + Math.random() * 5;
      }
      for (let i = shooters.length - 1; i >= 0; i--) {
        const s = shooters[i];
        s.life += 0.016;
        s.x += s.vx;
        s.y += s.vy;
        const t = s.life / s.maxLife;
        s.alpha = t < 0.3 ? t / 0.3 : 1 - (t - 0.3) / 0.7;
        if (s.life >= s.maxLife) { shooters.splice(i, 1); continue; }
        const grad = ctx!.createLinearGradient(s.x, s.y, s.x - s.len, s.y - s.len * 0.4);
        grad.addColorStop(0, `rgba(255,255,255,${s.alpha.toFixed(2)})`);
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx!.beginPath();
        ctx!.moveTo(s.x, s.y);
        ctx!.lineTo(s.x - s.len, s.y - s.len * 0.4);
        ctx!.strokeStyle = grad;
        ctx!.lineWidth = 1.2;
        ctx!.stroke();
      }

      animId = requestAnimationFrame(draw);
    }
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="star-field" aria-hidden="true" />;
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

  const canSubmit = useMemo(
    () => !!birthDate && !!birthTime && !!birthPlace && !!question.trim(),
    [birthDate, birthTime, birthPlace, question]
  );

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
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
        { retries: 2, timeoutMs: 20000 }
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
                <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
              </label>
              <label style={{ flex: 1 }}>
                <span className="label-icon"><Clock size={13} /> Time</span>
                <input type="time" value={birthTime} onChange={(e) => setBirthTime(e.target.value)} />
              </label>
            </motion.div>

            <motion.label variants={fadeUp}>
              <span className="label-icon"><MapPin size={13} /> Place of Query</span>
              <input
                value={birthPlace}
                onChange={(e) => setBirthPlace(e.target.value)}
                placeholder="City, Country"
                autoComplete="off"
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
              <span className="label-icon"><MessageCircle size={13} /> Prashna — Speak Your Question</span>
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Speak your query to the cosmos… e.g. Will this path lead to prosperity?"
                rows={3}
              />
            </motion.label>

            <motion.button
              className="btn"
              type="submit"
              disabled={!canSubmit || loading}
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
