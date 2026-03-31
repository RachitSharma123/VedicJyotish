'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { ApiError, fetchJson } from './lib/fetch-json';

type AIProvider = 'deepseek' | 'openrouter' | 'zai' | 'kimi';

type PrashnaSnapshot = {
  lagnaSign: string;
  lagnaLord: string;
  moonSign: string;
  relevanceHouses: string[];
  obstacleHouses: string[];
  localSiderealTime: string;
  rawAscendantDegrees: number;
  rawMoonDegrees: number;
  calculationNote: string;
};

type BirthChartResponse = { ok: true; interpretation: string; prashna: PrashnaSnapshot };
type ModelsResponse = { ok: true; models: string[]; defaultModel: string };

const PROVIDER_LABELS: Record<AIProvider, string> = {
  deepseek: 'DeepSeek',
  openrouter: 'OpenRouter',
  zai: 'Z.ai (Zhipu)',
  kimi: 'Kimi (Moonshot)',
};

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

export default function Page() {
  const [isDark, setIsDark] = useState(true);
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [birthTime, setBirthTime] = useState('');
  const [birthPlace, setBirthPlace] = useState('');
  const [direction, setDirection] = useState('North');
  const [question, setQuestion] = useState('');

  const [provider, setProvider] = useState<AIProvider>('deepseek');
  const [apiKey, setApiKey] = useState('');
  const [models, setModels] = useState<string[]>([]);
  const [model, setModel] = useState('');
  const [modelsLoading, setModelsLoading] = useState(false);

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
    () => !!birthDate && !!birthTime && !!birthPlace && !!question.trim() && !!provider && !!model,
    [birthDate, birthTime, birthPlace, question, provider, model]
  );

  async function loadModels() {
    setModelsLoading(true);
    setError('');
    try {
      const data = await fetchJson<ModelsResponse>(
        '/api/models',
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider, apiKey }) },
        { retries: 1, timeoutMs: 12000 }
      );
      setModels(data.models);
      setModel((current) => current || data.defaultModel || data.models[0] || '');
    } catch (err) {
      setModels([]);
      setError(err instanceof ApiError ? `Model fetch failed: ${err.message}` : 'Unable to load models from provider.');
    } finally {
      setModelsLoading(false);
    }
  }

  useEffect(() => { setModels([]); setModel(''); }, [provider]);

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
          body: JSON.stringify({ name, birthDate, birthTime, birthPlace, direction, question, provider, apiKey, model }),
        },
        { retries: 2, timeoutMs: 20000 }
      );
      setResult(data.interpretation);
      setPrashna(data.prashna);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? `${err.message}${err.requestId ? ` (id: ${err.requestId})` : ''}`
          : 'Unable to generate chart right now. Please retry in a few seconds.'
      );
    } finally {
      setLoading(false);
    }
  }

  const lagnaSymbol = prashna ? (ZODIAC_SYMBOLS[prashna.lagnaSign] ?? '✦') : '';
  const moonSymbol  = prashna ? (ZODIAC_SYMBOLS[prashna.moonSign]  ?? '✦') : '';
  const lordSymbol  = prashna ? (PLANET_SYMBOLS[prashna.lagnaLord] ?? '✦') : '';

  return (
    <main>
      {/* ── Hero ─────────────────────────────────── */}
      <header className="hero">
        <div className="hero-controls">
          <button className="theme-switch" type="button" onClick={() => setIsDark((v) => !v)}>
            {isDark ? '☀ Light' : '☽ Dark'}
          </button>
        </div>

        <span className="om-symbol">ॐ</span>
        <h1 className="title">VedicJyotish</h1>
        <p className="subtitle-main">Prashna Kundali Oracle</p>
        <p className="subtitle">Ancient wisdom · Celestial computation · AI interpretation</p>
      </header>

      <div className="cosmic-divider">✦ &nbsp; ✦ &nbsp; ✦</div>

      {/* ── Main Grid ────────────────────────────── */}
      <div className="layout-grid">

        {/* ── Form ─────────────────────────────── */}
        <form className="card card-strong form-stack" onSubmit={onSubmit}>

          {/* Provider section */}
          <div className="section-header">
            <span className="section-icon">☿</span>
            <h3 className="section-title">Oracle Configuration</h3>
          </div>

          <label>
            Provider
            <select value={provider} onChange={(e) => setProvider(e.target.value as AIProvider)}>
              {Object.entries(PROVIDER_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </label>

          <label>
            API Key <span style={{ textTransform: 'none', opacity: 0.6 }}>(session only)</span>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={`Paste ${PROVIDER_LABELS[provider]} key`}
            />
          </label>

          <div className="row">
            <label style={{ flex: 1 }}>
              Model
              <select value={model} onChange={(e) => setModel(e.target.value)}>
                <option value="">{modelsLoading ? 'Loading…' : 'Select model'}</option>
                {models.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </label>
            <button className="btn btn-secondary" type="button" onClick={loadModels} disabled={modelsLoading}>
              {modelsLoading ? 'Loading…' : 'Fetch Models'}
            </button>
          </div>

          {/* Divider */}
          <div className="form-divider">✦ Prashna Inputs ✦</div>

          <label>
            Name <span style={{ opacity: 0.55, textTransform: 'none' }}>(optional)</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Seeker's name" />
          </label>

          <div className="row">
            <label style={{ flex: 1 }}>
              Date
              <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
            </label>
            <label style={{ flex: 1 }}>
              Time
              <input type="time" value={birthTime} onChange={(e) => setBirthTime(e.target.value)} />
            </label>
          </div>

          <label>
            Location
            <input value={birthPlace} onChange={(e) => setBirthPlace(e.target.value)} placeholder="City, Country" />
          </label>

          <label>
            Direction Faced
            <select value={direction} onChange={(e) => setDirection(e.target.value)}>
              {['North','East','South','West','North-East','North-West','South-East','South-West'].map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </label>

          <label>
            Prashna Question
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Write your exact question — e.g. Will this relationship progress to marriage?"
              rows={4}
            />
          </label>

          <button className="btn" type="submit" disabled={!canSubmit || loading}>
            {loading
              ? <><span className="spin">✦</span>Reading the cosmos…</>
              : '✦ Reveal the Prashna Chart'
            }
          </button>

          {error
            ? <p className="error">{error}</p>
            : <p className="tip-text muted">Fetch models first, then ask your question.</p>
          }
        </form>

        {/* ── Right Column ─────────────────────── */}
        <div className="form-stack">

          {/* Result */}
          <section className="card card-strong">
            {result ? (
              <>
                <p className="result-panel-title">✦ Your Prashna Reading ✦</p>
                <div className="result-markdown">
                  <ReactMarkdown>{result}</ReactMarkdown>
                </div>
              </>
            ) : (
              <div className="result-placeholder">
                <div className="placeholder-symbol">🔮</div>
                <p>Your Prashna interpretation will manifest here</p>
              </div>
            )}
          </section>

          {/* Snapshot */}
          {prashna && (
            <section className="card">
              <p className="snapshot-title">✦ Celestial Snapshot ✦</p>
              <div className="stat-grid">

                <div className="stat">
                  <div className="stat-key">Lagna</div>
                  <div className="stat-val">
                    <span className="zodiac-sym">{lagnaSymbol}</span>
                    {prashna.lagnaSign}
                  </div>
                </div>

                <div className="stat">
                  <div className="stat-key">Lagna Lord</div>
                  <div className="stat-val">
                    <span className="zodiac-sym">{lordSymbol}</span>
                    {prashna.lagnaLord}
                  </div>
                </div>

                <div className="stat">
                  <div className="stat-key">Moon Sign</div>
                  <div className="stat-val">
                    <span className="zodiac-sym">{moonSymbol}</span>
                    {prashna.moonSign}
                  </div>
                </div>

                <div className="stat">
                  <div className="stat-key">Sidereal Time</div>
                  <div className="stat-val">{prashna.localSiderealTime}</div>
                </div>

                <div className="stat">
                  <div className="stat-key">Ascendant</div>
                  <div className="stat-val">{prashna.rawAscendantDegrees}°</div>
                </div>

                <div className="stat">
                  <div className="stat-key">Moon Longitude</div>
                  <div className="stat-val">{prashna.rawMoonDegrees}°</div>
                </div>

                <div className="stat" style={{ gridColumn: '1 / -1' }}>
                  <div className="stat-key">Relevant Houses</div>
                  <div className="stat-val" style={{ flexWrap: 'wrap' }}>
                    {prashna.relevanceHouses.map((h) => (
                      <span key={h} className="house-tag">{h}</span>
                    ))}
                  </div>
                </div>

                <div className="stat" style={{ gridColumn: '1 / -1' }}>
                  <div className="stat-key">Obstacle Houses</div>
                  <div className="stat-val" style={{ flexWrap: 'wrap' }}>
                    {prashna.obstacleHouses.map((h) => (
                      <span key={h} className="house-tag obstacle">{h}</span>
                    ))}
                  </div>
                </div>

                <div className="stat" style={{ gridColumn: '1 / -1' }}>
                  <div className="stat-key">Calculation Note</div>
                  <div className="stat-val" style={{ fontSize: '0.82rem', fontWeight: 400, opacity: 0.75 }}>
                    {prashna.calculationNote}
                  </div>
                </div>

              </div>
            </section>
          )}

        </div>
      </div>
    </main>
  );
}
